export class FileSelector extends Element {
  name = "";
  novalue = "";
  type = "file";

  constructor(props) {
    super(props);
    Object.assign(this, props);
  }

  render() {
    return <fileselector class={this.type}>
      <input|text novalue={this.novalue} />
      <button.select>Browse</button>
    </fileselector>;
  }

  get value() {
    return this.$("input").value;
  }

  doSelect() {
    return Window.this.selectFile({
      filter: "All Files (*.*)|*.*",
      mode: "open",
      caption: "Select file",
    });
  }

  ["on click at button.select"]() {
    const fn = this.doSelect();
    if (fn) {
      this.$("input").value = URL.toPath(fn);
      this.post(new Event("input", { bubbles: true }));
    }
    return true;
  }
}

export class FolderSelector extends FileSelector {
  constructor(props) {
    super(props);
    this.type = "folder";
  }

  doSelect() {
    return Window.this.selectFolder();
  }
}
