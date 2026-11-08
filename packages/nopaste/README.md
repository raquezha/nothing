# @raquezha/nopaste

Paste clipboard images into Pi on local Linux, local macOS, or over SSH. PNG, JPEG, GIF and WebP images and copied local image files are supported. A clipboard containing only a web link is **not** an image; use the browser's **Copy image** action instead.

## Install

This repository's shell integration loads nopaste automatically. For a standalone Pi installation on each machine running Pi:

```sh
pi install npm:@raquezha/nopaste
```

Do not also install it through Pi when using this repository's shell integration, or you may load two copies. For SSH, install the CLI on the computer with the clipboard:

```sh
npm install -g @raquezha/nopaste
```

## Paste

| Pi location | Start | Paste image |
| --- | --- | --- |
| Local Linux (Wayland or X11) | `pi` | `Alt+V` or `/nopaste` |
| Local macOS | `pi` | Pi's native `Ctrl+V`, `Alt+V`, or `/nopaste` |
| Mac over SSH from Linux | `ssh macmini` **from Linux** | `Alt+V` or `/nopaste` on Mac |

`/nopaste` and `Alt+V` insert a removable image marker into the draft. Write your message and press Enter; Pi receives image bytes, not a file path. Remove the marker to discard the image. `/nopaste describe this` sends immediately with the attached image. `/paste` is an alias. Native `Ctrl+V` is never overridden, so existing text and file paste still work.

This repository wraps a bare interactive `ssh macmini` login automatically. It starts a private local clipboard service and forwards its socket through that SSH session. Pi then gets a per-session socket and token, without a reverse connection from the Mac. The server must allow OpenSSH Unix-socket forwarding (`AllowStreamLocalForwarding yes`). Remote commands, file transfers, SSH options, and non-interactive SSH keep stock behavior; for those, use `nopaste ssh macmini -- COMMAND` explicitly. A remote shell multiplexer must inherit `NOPASTE_SOCKET` and `NOPASTE_TOKEN` from the login shell.

The Linux client needs `wl-paste` (Wayland) or `xclip` (X11), and Node.js. macOS uses the built-in Swift/AppKit pasteboard. `/nopaste-status` reports whether the SSH tunnel is configured; `nopaste status` checks the local clipboard. `nopaste save image.png` saves the local clipboard image without replacing an existing file.

The service reads clipboard images only on request, binds to a private Unix socket, requires a random session token, and accepts at most 20 MiB. As with Pi's own image attachments, submitted images are sent to your configured model provider.
