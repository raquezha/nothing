import AVFoundation
import CoreGraphics
import Foundation
import ImageIO

func fail(_ message: String) -> Never {
    fputs("story-video encoder: \(message)\n", stderr)
    exit(1)
}

let args = CommandLine.arguments
if args.count != 7 {
    fail("usage: encode.swift <frames-dir> <output> <frame-count> <width> <height> <fps>")
}

let framesDir = args[1]
let outputPath = args[2]
guard let frameCount = Int(args[3]), let width = Int(args[4]), let height = Int(args[5]), let fps = Int32(args[6]),
      frameCount > 0, width > 0, height > 0, fps > 0 else {
    fail("frame count, width, height, and fps must be positive integers")
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
let semaphore = DispatchSemaphore(value: 0)
writer.finishWriting { semaphore.signal() }
guard semaphore.wait(timeout: .now() + 120) == .success else { fail("writer did not finish within 120 seconds") }
guard writer.status == .completed else { fail("writer failed: \(writer.error?.localizedDescription ?? "unknown error")") }
guard let size = try? FileManager.default.attributesOfItem(atPath: outputPath)[.size] as? NSNumber, size.intValue > 0 else {
    fail("writer produced no output")
}
print("Encoded \(frameCount) frames to \(outputPath)")
