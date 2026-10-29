# Selected page capture

Load this directory as an unpacked Chromium extension using the browser's extension settings.
Open your signed-in Pegboard installation at `/app/capture` and click **Capture selected page** in the toolbar to connect that tab. Keep it open. On a source web page, explicitly select the text you want and click the same toolbar action. Only the page title, selected text and a source link without credentials, query or fragment enter the first-party preview. The extension never reads the rest of the page or sends native session cookies.

Choose a project, choose an existing authorized owner, review visibility, and confirm. Choosing My tasks keeps the task private. Cancel creates no work. Source documents and selections must remain unchanged and open until confirmation. Navigation, source permission loss, closing the source tab, reconnecting a different app tab or restarting the browser requires a new capture. Replaying a confirmed intent does not create another task. Previews expire after fifteen minutes and belong to the native session that opened them.

The extension uses the browser's temporary `activeTab` permission from explicit toolbar gestures. It requests no blanket host permission, background page reading or provider account access. It stores pending source checks only in browser session storage. The destination receives plain text and never evaluates captured HTML. This package implements selected web pages only; mail intake, attachments and connected chat actions are not implemented here.
