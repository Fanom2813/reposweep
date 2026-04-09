import * as debug from "@debug";
import { Application } from "app.js";

debug.setUnhandledExceptionHandler(function(err) {
  console.error("UNHANDLED:", err.toString(), err.stack);
});

document.ready = function() {
  Window.this.minSize = [960 * devicePixelRatio, 680 * devicePixelRatio];
  document.body.patch(<Application />);

  // Debug: dump what actually rendered
  console.log("body tag:", document.body.tag);
  console.log("body children:", document.body.children.length);
  for (let i = 0; i < document.body.children.length; i++) {
    const ch = document.body.children[i];
    console.log(`  child[${i}]: <${ch.tag}> class="${ch.className}" style.width=${ch.style.width} style.height=${ch.style.height}`);
    console.log(`  child[${i}] box:`, ch.box("width"), "x", ch.box("height"));
  }
  console.log("body box:", document.body.box("width"), "x", document.body.box("height"));
};
