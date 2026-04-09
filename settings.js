import * as env from "@env";
import * as sys from "@sys";
import { encode, decode } from "@sciter";

const APP_NAME = "reposweep";
const path = env.path("appdata", APP_NAME + ".json");

export function loadState() {
  try {
    const raw = sys.fs.$readfile(path, "r");
    return JSON.parse(decode(raw, "utf-8"));
  } catch (_) {
    return null;
  }
}

export async function saveState(state) {
  let file = null;
  try {
    file = await sys.fs.open(path, "w+", 0o666);
    const raw = encode(JSON.stringify(state, null, 2), "utf-8");
    await file.write(raw);
  } catch (error) {
    Window.this.modal(
      <warning>
        Cannot save RepoSweep settings.
        <br />
        {String(error)}
      </warning>
    );
  } finally {
    if (file) file.close();
  }
}
