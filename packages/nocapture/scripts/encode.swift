import AVFoundation
import CoreGraphics
import CoreMedia
import Foundation
import ImageIO

func fail(_ message: String) -> Never {
    fputs("story-video encoder: \(message)\n", stderr)
    exit(1)
}

let args = CommandLine.arguments
if args.count != 7 && args.count != 8 {
    fail("usage: encode.swift <frames-dir> <output> <frame-count> <width> <height> <fps> [audio-path]")
}

let framesDir = args[1]
let outputPath = args[2]
let audioPath: String? = args.count == 8 && !args[7].isEmpty ? args[7] : nil
guard let frameCount = Int(args[3]), let width = Int(args[4]), let height = Int(args[5]), let fps = Int32(args[6]),
      frameCount > 0, width > 0, height > 0, fps > 0 else {
    fail("frame count, width, height, and fps must be positive integers")
}

if let audioPath = audioPath, !FileManager.default.fileExists(atPath: audioPath) {
    fail("audio file does not exist: \(audioPath)")
}

guard !FileManager.default.fileExists(atPath: outputPath) else {
    fail("temporary output already exists: \(outputPath)")
}

func frameURL(_ index: Int) -> URL {
    URL(fileURLWithPath: framesDir).appendingPathComponent(String(format: "frame_%06d.png", index))
}

for index in 0..<frameCount {
    let url = frameURL(index)
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
          let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
          let imageWidth = properties[kCGImagePropertyPixelWidth] as? NSNumber,
          let imageHeight = properties[kCGImagePropertyPixelHeight] as? NSNumber else {
        fail("missing or unreadable frame \(index): \(url.path)")
    }
    guard imageWidth.intValue == width, imageHeight.intValue == height else {
        fail("frame \(index) dimensions are \(imageWidth)x\(imageHeight), expected \(width)x\(height)")
    }
}

let outputURL = URL(fileURLWithPath: outputPath)
let writer: AVAssetWriter
do {
    writer = try AVAssetWriter(outputURL: outputURL, fileType: .mp4)
} catch {
    fail("could not create writer: \(error.localizedDescription)")
}
writer.shouldOptimizeForNetworkUse = true

let settings: [String: Any] = [
    AVVideoCodecKey: AVVideoCodecType.h264,
    AVVideoWidthKey: width,
    AVVideoHeightKey: height,
    AVVideoColorPropertiesKey: [
        AVVideoColorPrimariesKey: AVVideoColorPrimaries_ITU_R_709_2,
        AVVideoTransferFunctionKey: AVVideoTransferFunction_ITU_R_709_2,
        AVVideoYCbCrMatrixKey: AVVideoYCbCrMatrix_ITU_R_709_2,
    ],
    AVVideoCompressionPropertiesKey: [
        AVVideoAverageBitRateKey: 1_500_000,
        AVVideoExpectedSourceFrameRateKey: fps,
        AVVideoMaxKeyFrameIntervalKey: fps,
    ],
]
let input = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
input.expectsMediaDataInRealTime = false
let adaptor = AVAssetWriterInputPixelBufferAdaptor(
    assetWriterInput: input,
    sourcePixelBufferAttributes: [
        kCVPixelBufferPixelFormatTypeKey as String: Int(kCVPixelFormatType_32BGRA),
        kCVPixelBufferWidthKey as String: width,
        kCVPixelBufferHeightKey as String: height,
    ]
)
guard writer.canAdd(input) else { fail("could not add video input") }
writer.add(input)

var audioReader: AVAssetReader?
var audioReaderOutput: AVAssetReaderTrackOutput?
var audioWriterInput: AVAssetWriterInput?
let targetDuration = CMTime(value: CMTimeValue(frameCount), timescale: fps)

if let audioPath = audioPath {
    let audioURL = URL(fileURLWithPath: audioPath)
    let audioAsset = AVURLAsset(url: audioURL)
    let audioTracks = audioAsset.tracks(withMediaType: .audio)
    guard let audioTrack = audioTracks.first else {
        fail("audio file contains no readable audio track: \(audioPath)")
    }
    let reader: AVAssetReader
    do {
        reader = try AVAssetReader(asset: audioAsset)
    } catch {
        fail("could not read audio file: \(error.localizedDescription)")
    }
    reader.timeRange = CMTimeRange(start: .zero, duration: targetDuration)
    let readerSettings: [String: Any] = [
        AVFormatIDKey: kAudioFormatLinearPCM,
        AVLinearPCMBitDepthKey: 16,
        AVLinearPCMIsFloatKey: false,
        AVLinearPCMIsBigEndianKey: false,
        AVLinearPCMIsNonInterleaved: false,
    ]
    let trackOutput = AVAssetReaderTrackOutput(track: audioTrack, outputSettings: readerSettings)
    trackOutput.alwaysCopiesSampleData = false
    guard reader.canAdd(trackOutput) else { fail("could not attach audio track reader") }
    reader.add(trackOutput)

    var sampleRate = 44_100.0
    var channels = 2
    if let desc = audioTrack.formatDescriptions.first {
        let fmtDesc = desc as! CMAudioFormatDescription
        if let basic = CMAudioFormatDescriptionGetStreamBasicDescription(fmtDesc)?.pointee {
            if basic.mSampleRate > 0 { sampleRate = basic.mSampleRate }
            if basic.mChannelsPerFrame > 0 { channels = max(1, min(2, Int(basic.mChannelsPerFrame))) }
        }
    }
    let audioOutputSettings: [String: Any] = [
        AVFormatIDKey: kAudioFormatMPEG4AAC,
        AVSampleRateKey: sampleRate,
        AVNumberOfChannelsKey: channels,
        AVEncoderBitRateKey: 128_000,
    ]
    let writerAudioInput = AVAssetWriterInput(mediaType: .audio, outputSettings: audioOutputSettings)
    writerAudioInput.expectsMediaDataInRealTime = false
    guard writer.canAdd(writerAudioInput) else { fail("could not add audio writer input") }
    writer.add(writerAudioInput)

    guard reader.startReading() else {
        fail("could not start reading audio: \(reader.error?.localizedDescription ?? "unknown error")")
    }
    audioReader = reader
    audioReaderOutput = trackOutput
    audioWriterInput = writerAudioInput
}

guard writer.startWriting() else { fail("could not start writer: \(writer.error?.localizedDescription ?? "unknown error")") }
writer.startSession(atSourceTime: .zero)

let colorSpace = CGColorSpace(name: CGColorSpace.sRGB)!
let bitmapInfo = CGBitmapInfo.byteOrder32Little.rawValue | CGImageAlphaInfo.premultipliedFirst.rawValue
for index in 0..<frameCount {
    let deadline = Date().addingTimeInterval(30)
    while !input.isReadyForMoreMediaData {
        guard writer.status == .writing else { fail("writer stopped before frame \(index): \(writer.error?.localizedDescription ?? "unknown error")") }
        guard Date() < deadline else { fail("writer did not become ready for frame \(index) within 30 seconds") }
        Thread.sleep(forTimeInterval: 0.01)
    }
    let url = frameURL(index)
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
          let image = CGImageSourceCreateImageAtIndex(source, 0, nil),
          let pool = adaptor.pixelBufferPool else {
        fail("could not decode frame \(index)")
    }
    var pixelBufferOut: CVPixelBuffer?
    guard CVPixelBufferPoolCreatePixelBuffer(kCFAllocatorDefault, pool, &pixelBufferOut) == kCVReturnSuccess,
          let pixelBuffer = pixelBufferOut else {
        fail("could not allocate pixel buffer for frame \(index)")
    }
    CVPixelBufferLockBaseAddress(pixelBuffer, [])
    guard let base = CVPixelBufferGetBaseAddress(pixelBuffer) else {
        CVPixelBufferUnlockBaseAddress(pixelBuffer, [])
        fail("could not access pixel buffer for frame \(index)")
    }
    guard let context = CGContext(
        data: base,
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: CVPixelBufferGetBytesPerRow(pixelBuffer),
        space: colorSpace,
        bitmapInfo: bitmapInfo
    ) else {
        CVPixelBufferUnlockBaseAddress(pixelBuffer, [])
        fail("could not create drawing context for frame \(index)")
    }
    context.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
    CVPixelBufferUnlockBaseAddress(pixelBuffer, [])
    guard adaptor.append(pixelBuffer, withPresentationTime: CMTime(value: CMTimeValue(index), timescale: fps)) else {
        fail("could not append frame \(index): \(writer.error?.localizedDescription ?? "unknown error")")
    }
}

input.markAsFinished()

if let audioWriterInput = audioWriterInput, let audioReader = audioReader, let audioReaderOutput = audioReaderOutput {
    while true {
        let deadline = Date().addingTimeInterval(30)
        while !audioWriterInput.isReadyForMoreMediaData {
            guard writer.status == .writing else {
                fail("writer stopped while encoding audio: \(writer.error?.localizedDescription ?? "unknown error")")
            }
            guard Date() < deadline else { fail("audio writer did not become ready within 30 seconds") }
            Thread.sleep(forTimeInterval: 0.005)
        }
        if let sampleBuffer = audioReaderOutput.copyNextSampleBuffer() {
            guard audioWriterInput.append(sampleBuffer) else {
                fail("could not append audio samples: \(writer.error?.localizedDescription ?? "unknown error")")
            }
        } else {
            if audioReader.status == .failed {
                fail("audio reader failed: \(audioReader.error?.localizedDescription ?? "unknown error")")
            }
            audioWriterInput.markAsFinished()
            break
        }
    }
}

let semaphore = DispatchSemaphore(value: 0)
writer.finishWriting { semaphore.signal() }
guard semaphore.wait(timeout: .now() + 120) == .success else { fail("writer did not finish within 120 seconds") }
guard writer.status == .completed else { fail("writer failed: \(writer.error?.localizedDescription ?? "unknown error")") }
guard let size = try? FileManager.default.attributesOfItem(atPath: outputPath)[.size] as? NSNumber, size.intValue > 0 else {
    fail("writer produced no output")
}
print("Encoded \(frameCount) frames to \(outputPath)")
