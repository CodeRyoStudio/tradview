import XCTest

final class BridgeSmokeTests: XCTestCase {
    private let allowedHosts: Set<String> = ["127.0.0.1", "localhost", "10.0.2.2"]

    private func isAllowed(_ url: URL) -> Bool {
        guard let host = url.host, allowedHosts.contains(host) else { return false }
        let path = url.path
        return path.hasSuffix("workspace.html") || path.hasSuffix("multi-chart.html") || path == "/"
    }

    func testAllowedPlaygroundPaths() {
        let base = URL(string: "http://127.0.0.1:5173")!
        XCTAssertTrue(isAllowed(base.appendingPathComponent("workspace.html")))
        XCTAssertTrue(isAllowed(base.appendingPathComponent("multi-chart.html")))
        XCTAssertFalse(isAllowed(URL(string: "https://evil.example/phish")!))
    }
}