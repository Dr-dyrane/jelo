import AVFoundation
import CoreGraphics
import CoreVideo
import Foundation
import ImageIO

struct FrameSpec {
    let path: String
    let duration: Double
}

func fail(_ message: String) -> Never {
    FileHandle.standardError.write(Data((message + "\n").utf8))
    exit(1)
}

func loadImage(_ path: String) -> CGImage {
    let url = URL(fileURLWithPath: path) as CFURL
    guard
        let source = CGImageSourceCreateWithURL(url, nil),
        let image = CGImageSourceCreateImageAtIndex(source, 0, nil)
    else {
        fail("Could not read image: \(path)")
    }
    return image
}

func pixelBuffer(from image: CGImage, width: Int, height: Int) -> CVPixelBuffer {
    let options: [CFString: Any] = [
        kCVPixelBufferCGImageCompatibilityKey: true,
        kCVPixelBufferCGBitmapContextCompatibilityKey: true,
    ]
    var pixelBuffer: CVPixelBuffer?
    let status = CVPixelBufferCreate(
        kCFAllocatorDefault,
        width,
        height,
        kCVPixelFormatType_32BGRA,
        options as CFDictionary,
        &pixelBuffer
    )
    guard status == kCVReturnSuccess, let buffer = pixelBuffer else {
        fail("Could not allocate a video frame.")
    }

    CVPixelBufferLockBaseAddress(buffer, [])
    defer { CVPixelBufferUnlockBaseAddress(buffer, []) }
    guard
        let baseAddress = CVPixelBufferGetBaseAddress(buffer),
        let context = CGContext(
            data: baseAddress,
            width: width,
            height: height,
            bitsPerComponent: 8,
            bytesPerRow: CVPixelBufferGetBytesPerRow(buffer),
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo:
                CGImageAlphaInfo.premultipliedFirst.rawValue
                | CGBitmapInfo.byteOrder32Little.rawValue
        )
    else {
        fail("Could not create the video drawing context.")
    }

    context.setFillColor(CGColor(gray: 0, alpha: 1))
    context.fill(CGRect(x: 0, y: 0, width: width, height: height))

    let imageRatio = CGFloat(image.width) / CGFloat(image.height)
    let canvasRatio = CGFloat(width) / CGFloat(height)
    var drawRect = CGRect(x: 0, y: 0, width: width, height: height)
    if imageRatio > canvasRatio {
        let scaledWidth = CGFloat(height) * imageRatio
        drawRect.origin.x = (CGFloat(width) - scaledWidth) / 2
        drawRect.size.width = scaledWidth
    } else {
        let scaledHeight = CGFloat(width) / imageRatio
        drawRect.origin.y = (CGFloat(height) - scaledHeight) / 2
        drawRect.size.height = scaledHeight
    }
    context.draw(image, in: drawRect)
    return buffer
}

let arguments = Array(CommandLine.arguments.dropFirst())
guard arguments.count >= 2 else {
    fail(
        "Usage: swift encode-slideshow.swift output.mp4 image.png=seconds [image.png=seconds ...]"
    )
}

let outputPath = arguments[0]
let frameSpecs: [FrameSpec] = arguments.dropFirst().map { argument in
    guard
        let separator = argument.lastIndex(of: "="),
        let duration = Double(argument[argument.index(after: separator)...]),
        duration > 0
    else {
        fail("Invalid frame specification: \(argument)")
    }
    return FrameSpec(
        path: String(argument[..<separator]),
        duration: duration
    )
}

let outputURL = URL(fileURLWithPath: outputPath)
try? FileManager.default.removeItem(at: outputURL)

let width = 1080
let height = 1920
let frameRate: Int32 = 30
let frameStep = CMTime(value: 1, timescale: frameRate)

let writer: AVAssetWriter
do {
    writer = try AVAssetWriter(outputURL: outputURL, fileType: .mp4)
} catch {
    fail("Could not create video writer: \(error.localizedDescription)")
}

let settings: [String: Any] = [
    AVVideoCodecKey: AVVideoCodecType.h264,
    AVVideoWidthKey: width,
    AVVideoHeightKey: height,
    AVVideoCompressionPropertiesKey: [
        AVVideoAverageBitRateKey: 8_000_000,
        AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
    ],
]
let input = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
input.expectsMediaDataInRealTime = false
let adaptor = AVAssetWriterInputPixelBufferAdaptor(
    assetWriterInput: input,
    sourcePixelBufferAttributes: [
        kCVPixelBufferPixelFormatTypeKey as String:
            Int(kCVPixelFormatType_32BGRA),
        kCVPixelBufferWidthKey as String: width,
        kCVPixelBufferHeightKey as String: height,
    ]
)

guard writer.canAdd(input) else {
    fail("The video writer rejected its input.")
}
writer.add(input)
guard writer.startWriting() else {
    fail("Video writer failed to start: \(writer.error?.localizedDescription ?? "unknown error")")
}
writer.startSession(atSourceTime: .zero)

var cursor = CMTime.zero
for spec in frameSpecs {
    let buffer = pixelBuffer(
        from: loadImage(spec.path),
        width: width,
        height: height
    )
    while !input.isReadyForMoreMediaData {
        usleep(5_000)
    }
    guard adaptor.append(buffer, withPresentationTime: cursor) else {
        fail("Could not append frame: \(spec.path)")
    }

    let duration = CMTime(seconds: spec.duration, preferredTimescale: 600)
    let ending = CMTimeAdd(cursor, duration)
    let finalSampleTime = CMTimeSubtract(ending, frameStep)
    if CMTimeCompare(finalSampleTime, cursor) > 0 {
        while !input.isReadyForMoreMediaData {
            usleep(5_000)
        }
        guard adaptor.append(buffer, withPresentationTime: finalSampleTime) else {
            fail("Could not extend frame duration: \(spec.path)")
        }
    }
    cursor = ending
}

input.markAsFinished()
writer.endSession(atSourceTime: cursor)
let semaphore = DispatchSemaphore(value: 0)
writer.finishWriting {
    semaphore.signal()
}
semaphore.wait()

guard writer.status == .completed else {
    fail("Video export failed: \(writer.error?.localizedDescription ?? "unknown error")")
}
print(outputPath)
