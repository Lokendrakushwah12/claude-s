// Subject lift with macOS Vision (the Photos "lift subject" model, macOS 14+, no download): swift lift.swift in.jpg out.png
// Writes the full-size image with everything but the subject(s) transparent; stickers.py trims it. Exit 1 = no subject / failure.
import CoreImage
import Foundation
import Vision

let a = CommandLine.arguments
guard a.count == 3 else { fputs("usage: lift in.jpg out.png\n", stderr); exit(2) }
let handler = VNImageRequestHandler(url: URL(fileURLWithPath: a[1]))
let req = VNGenerateForegroundInstanceMaskRequest()
do {
  try handler.perform([req])
  guard let obs = req.results?.first, !obs.allInstances.isEmpty else { fputs("no subject found\n", stderr); exit(1) }
  let buf = try obs.generateMaskedImage(ofInstances: obs.allInstances, from: handler, croppedToInstancesExtent: false)
  try CIContext().writePNGRepresentation(of: CIImage(cvPixelBuffer: buf), to: URL(fileURLWithPath: a[2]), format: .RGBA8,
                                         colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!)
} catch { fputs("vision failed: \(error)\n", stderr); exit(1) }
