# Markdown PicGo Editor

A powerful Markdown editor for VS Code based on [Vditor](https://github.com/Vanessa219/vditor), featuring seamless image uploading via [PicGo](https://github.com/PicGo/PicGo-Core).

## Features

- **WYSIWYG Markdown Editing**: Enjoy a rich editing experience with Vditor's Instant Rendering mode.
- **PicGo Integration**: Paste images directly into the editor to upload them using PicGo.
- **WSL Clipboard Support**: Seamlessly paste images from your Windows clipboard into the WSL editor for upload.
- **Customizable Toolbar**: Includes a button to quickly switch back to the default VS Code editor.

## Prerequisites

This extension relies on `picgo` for image uploads. Please ensure you have it installed globally:

```bash
npm install -g picgo
```

You also need to configure PicGo with your preferred image hosting service. The configuration file is typically located at `~/.picgo/config.json`.

## Recommended Plugins

For better image organization, we highly recommend installing the `picgo-plugin-folder-name` plugin. This allows uploaded images to be saved in a subfolder named after your Markdown file.

```bash
picgo install folder-name
```

This extension is designed to work seamlessly with this plugin by providing the correct context for the image upload.

## Configuration

- `vditor.picgoPath`: Path to the PicGo executable. Defaults to `picgo`.

## Usage

1. Open any `.md` file.
2. The file will open in the Vditor editor by default.
3. Paste an image to upload it automatically.
4. Use the "Switch to Default Editor" button in the toolbar if you need to edit the raw Markdown source.

## License

MIT
