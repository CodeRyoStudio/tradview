import SwiftUI
import WebKit

struct ContentView: View {
    var body: some View {
        WebViewRepresentable()
            .ignoresSafeArea()
    }
}

struct WebViewRepresentable: UIViewRepresentable {
    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.preferences.javaScriptEnabled = true
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        if let url = URL(string: SampleConfig.playgroundURL) {
            webView.load(URLRequest(url: url))
        }
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    final class Coordinator: NSObject, WKNavigationDelegate {
        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.cancel)
                return
            }
            decisionHandler(SampleConfig.isAllowedPlaygroundURL(url) ? .allow : .cancel)
        }
    }
}

enum SampleConfig {
    static var playgroundURL: String {
        Bundle.main.object(forInfoDictionaryKey: "PLAYGROUND_URL") as? String
            ?? "http://127.0.0.1:5173/workspace.html"
    }

    private static let allowedHosts: Set<String> = ["127.0.0.1", "localhost", "10.0.2.2"]

    static func isAllowedPlaygroundURL(_ url: URL) -> Bool {
        guard let host = url.host, allowedHosts.contains(host) else { return false }
        let path = url.path
        return path.hasSuffix("workspace.html")
            || path.hasSuffix("multi-chart.html")
            || path == "/"
    }
}