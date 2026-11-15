// Subject mattes from macOS's own subject lifting (Vision VNGenerateForegroundInstanceMaskRequest, macOS 14+: the
// "Copy Subject" model, on the Neural Engine, nothing downloaded). Any salient subject, not just people: friends, a horse, a
// boulder. aura.py build runs it for shots with behind: "subject"; it writes the same files as matte.py.
//
//     swiftc -O cutout.swift -o .cutout && ./.cutout frames/s03 [frames/s07 ...]
//
// frames/sNN/0001.jpg... -> frames/sNN/m0001.jpg... (grey: white = subject, in front of the type). A frame where Vision finds
// no subject gets an all-black matte (the type stays in front), so a sequence never has a missing frame.
import CoreImage
import Foundation
import Vision

let ctx = CIContext()
func matte(_ url: URL) -> CIImage? {
    guard let img = CIImage(contentsOf: url) else { return nil }
    let req = VNGenerateForegroundInstanceMaskRequest()
    let h = VNImageRequestHandler(ciImage: img)
    try? h.perform([req])
    let black = CIImage(color: .black).cropped(to: img.extent)
    guard let r = req.results?.first,
          let buf = try? r.generateScaledMaskForImage(forInstances: r.allInstances, from: h) else { return black }
    return CIImage(cvPixelBuffer: buf).cropped(to: img.extent)
}

for dir in CommandLine.arguments.dropFirst() {
    let d = URL(fileURLWithPath: dir)
    let files = (try? FileManager.default.contentsOfDirectory(at: d, includingPropertiesForKeys: nil)) ?? []
    let frames = files.filter { $0.pathExtension == "jpg" && $0.lastPathComponent.first?.isNumber == true }.sorted { $0.path < $1.path }
    var n = 0
    for f in frames {
        guard let m = matte(f) else { continue }
        let out = d.appendingPathComponent("m" + f.lastPathComponent)
        try? ctx.writeJPEGRepresentation(of: m, to: out, colorSpace: CGColorSpaceCreateDeviceGray(),
                                         options: [kCGImageDestinationLossyCompressionQuality as CIImageRepresentationOption: 0.9])
        n += 1
    }
    print("\(dir): \(n) subject mattes")
}
