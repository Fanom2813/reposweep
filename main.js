import * as debug from "@debug";
import { Application } from "app.js";
import { close as closeStorage } from "lib/settings.js";

debug.setUnhandledExceptionHandler(function(err) {
  console.error("UNHANDLED:", err.toString(), err.stack);
});

document.ready = function() {
  Window.this.minSize = [960 * devicePixelRatio, 680 * devicePixelRatio];
  document.body.patch(<Application />);
};

document.on("beforeunload", function() {
  closeStorage();
});
