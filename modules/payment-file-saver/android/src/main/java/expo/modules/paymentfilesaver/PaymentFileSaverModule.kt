package expo.modules.paymentfilesaver

import android.app.Activity
import android.content.Intent
import java.io.OutputStream
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class PaymentFileSaverModule : Module() {

  companion object {
    private const val CREATE_DOCUMENT_REQUEST_CODE = 7412
  }

  private var pendingPromise: Promise? = null
  private var pendingContent: String? = null

  override fun definition() = ModuleDefinition {
    Name("PaymentFileSaver")

    AsyncFunction("saveFile") {
        filename: String,
        mimeType: String,
        content: String,
        promise: Promise ->

      if (pendingPromise != null) {
        promise.reject(
          "SAVE_IN_PROGRESS",
          "Another file save operation is already in progress.",
          null
        )
        return@AsyncFunction
      }

      val activity = appContext.throwingActivity

      pendingPromise = promise
      pendingContent = content

      val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
        addCategory(Intent.CATEGORY_OPENABLE)
        type = mimeType
        putExtra(Intent.EXTRA_TITLE, filename)
      }

      activity.startActivityForResult(
        intent,
        CREATE_DOCUMENT_REQUEST_CODE
      )
    }

    OnActivityResult { _, payload ->

      if (payload.requestCode != CREATE_DOCUMENT_REQUEST_CODE) {
        return@OnActivityResult
      }

      val promise = pendingPromise
      val content = pendingContent

      pendingPromise = null
      pendingContent = null

      if (promise == null || content == null) {
        return@OnActivityResult
      }

      if (payload.resultCode != Activity.RESULT_OK) {
        promise.reject(
          "SAVE_CANCELLED",
          "File save was cancelled.",
          null
        )
        return@OnActivityResult
      }

      val uri = payload.data?.data

      if (uri == null) {
        promise.reject(
          "NO_FILE_URI",
          "Android did not return a file location.",
          null
        )
        return@OnActivityResult
      }

      try {
        val context = appContext.reactContext
          ?: throw IllegalStateException("React context is unavailable.")

        val outputStream: OutputStream =
          context.contentResolver.openOutputStream(uri)
            ?: throw IllegalStateException(
              "Unable to open the selected file for writing."
            )

        outputStream.use { stream ->
          stream.write(content.toByteArray(Charsets.UTF_8))
          stream.flush()
        }

        promise.resolve(uri.toString())

      } catch (error: Exception) {
        promise.reject(
          "SAVE_FAILED",
          error.message ?: "Unable to save the backup file.",
          error
        )
      }
    }
  }
}