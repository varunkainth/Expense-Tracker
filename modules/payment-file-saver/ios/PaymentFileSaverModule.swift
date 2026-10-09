import ExpoModulesCore
import UIKit

private final class FileExportDelegate: NSObject, UIDocumentPickerDelegate, UIAdaptivePresentationControllerDelegate {
  let sourceURL: URL
  var onFinish: ((Result<URL, Error>) -> Void)?
  private var hasFinished = false

  init(sourceURL: URL) {
    self.sourceURL = sourceURL
  }

  func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
    guard let url = urls.first else {
      finish(.failure(NSError(domain: "PaymentFileSaver", code: 1, userInfo: [NSLocalizedDescriptionKey: "No save location was selected."])))
      return
    }
    finish(.success(url))
  }

  func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
    finish(.failure(NSError(domain: "PaymentFileSaver", code: 2, userInfo: [NSLocalizedDescriptionKey: "File save was cancelled."])))
  }

  func presentationControllerDidDismiss(_ presentationController: UIPresentationController) {
    finish(.failure(NSError(domain: "PaymentFileSaver", code: 2, userInfo: [NSLocalizedDescriptionKey: "File save was cancelled."])))
  }

  private func finish(_ result: Result<URL, Error>) {
    guard !hasFinished else { return }
    hasFinished = true
    try? FileManager.default.removeItem(at: sourceURL)
    onFinish?(result)
    onFinish = nil
  }
}

public class PaymentFileSaverModule: Module {
  private var pendingExport: FileExportDelegate?

  public func definition() -> ModuleDefinition {
    Name("PaymentFileSaver")

    AsyncFunction("saveFile") { (filename: String, _ mimeType: String, content: String, promise: Promise) in
      guard self.pendingExport == nil else {
        promise.reject("SAVE_IN_PROGRESS", "Another file save operation is already in progress.")
        return
      }

      guard let viewController = self.appContext?.utilities?.currentViewController() else {
        promise.reject("MISSING_VIEW_CONTROLLER", "Unable to open the file picker.")
        return
      }

      let safeFilename = URL(fileURLWithPath: filename).lastPathComponent
      let sourceURL = FileManager.default.temporaryDirectory.appendingPathComponent(safeFilename)
      do {
        try Data(content.utf8).write(to: sourceURL, options: .atomic)
      } catch {
        promise.reject(error)
        return
      }

      let delegate = FileExportDelegate(sourceURL: sourceURL)
      delegate.onFinish = { [weak self] result in
        self?.pendingExport = nil
        switch result {
        case .success(let url):
          promise.resolve(url.absoluteString)
        case .failure(let error):
          promise.reject(error)
        }
      }
      self.pendingExport = delegate

      let picker = UIDocumentPickerViewController(forExporting: [sourceURL], asCopy: true)
      picker.delegate = delegate
      picker.presentationController?.delegate = delegate
      viewController.present(picker, animated: true)
    }.runOnQueue(.main)
  }
}
