//
//  ViewController.swift
//  DPAA Testing Software
// 
//  Created by Thomas Radabaugh on 1/5/25.
//

import UIKit
import WebKit

class ViewController: UIViewController, WKUIDelegate {
    
    var webView: WKWebView!
    
    override func loadView() {
        let procterPasscode = "procter"
        let adminPasscode = "admin"
        let passCodeString = procterPasscode + "|" + adminPasscode
        
        let webConfiguration = WKWebViewConfiguration()
        let source: String =
            "var meta = document.createElement('meta');" +
            "meta.name = 'viewport';" +
            "meta.id = '" + passCodeString + "';" +
            "meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';" +
            "var head = document.getElementsByTagName('head')[0];" +
            "head.appendChild(meta);"
        let script: WKUserScript = WKUserScript(source: source, injectionTime: .atDocumentEnd, forMainFrameOnly: true)
        webConfiguration.userContentController.addUserScript(script)
        webView = WKWebView(frame: .zero, configuration: webConfiguration)
        webView.uiDelegate = self
        view = webView
        
    }


    override func viewDidLoad() {
        super.viewDidLoad()
        
        let myURL = URL(string:"https://crazymeowcows.github.io/index.html")
        let myRequest = URLRequest(url: myURL!, cachePolicy: .reloadIgnoringLocalAndRemoteCacheData)
        webView.load(myRequest)
    }
}

