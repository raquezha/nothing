import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

func fail(_ message: String) -> Never {
    fputs("article-media gif encoder: \(message)\n", stderr)
    exit(1)
}

let args = CommandLine.arguments
if args.count != 7 {
    fail("usage: encode-gif.swift <frames-dir> <output> <frame-count> <width> <height> <fps>")
}

let framesDir = args[1]
let outputPath = args[2]
guard let frameCount = Int(args[3]), let width = Int(args[4]), let height = Int(args[5]), let fps = Double(args[6]),
      frameCount > 0, width > 0, height > 0, fps > 0 else {
    fail("frame count, width, height, and fps must be positive numbers")
}

guard !FileManager.default.fileExists(atPath: outputPath) else {
    fail("temporary output already exists: \(outputPath)")
}

func frameURL(_ index: Int) -> URL {
    URL(fileURLWithPath: framesDir).appendingPathComponent(String(format: "frame_%06d.png", index))
}

let frameDelay = 1.0 / fps
let outputURL = URL(fileURLWithPath: outputPath)
guard let destination = CGImageDestinationCreateWithURL(outputURL as CFURL, UTType.gif.identifier as CFString, frameCount, nil) else {
    fail("unable to create GIF destination at \(outputPath)")
}

let fileProperties: [CFString: Any] = [
    kCGImagePropertyGIFDictionary: [
        kCGImagePropertyGIFLoopCount: 0
    ]
]
CGImageDestinationSetProperties(destination, fileProperties as CFDictionary)

let frameProperties: [CFString: Any] = [
    kCGImagePropertyGIFDictionary: [
        kCGImagePropertyGIFDelayTime: frameDelay,
        kCGImagePropertyGIFUnclampedDelayTime: frameDelay
    ]
]

for index in 0..<frameCount {
    let url = frameURL(index)
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
          let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
        fail("missing or unreadable frame \(index): \(url.path)")
    }
    guard image.width == width, image.height == height else {
        fail("frame \(index) dimensions are \(image.width)x\(image.height), expected \(width)x\(height)")
    }
    CGImageDestinationAddImage(destination, image, frameProperties as CFDictionary)
}

guard CGImageDestinationFinalize(destination) else {
    fail("failed to finalize GIF output at \(outputPath)")
}
