# HDL BlockSeal

[![vscode marketplace](https://img.shields.io/badge/VS%20Code-HDL_BlockSeal-blue)](https://marketplace.visualstudio.com/items?itemName=VENOMNBB.hdl-blockseal)
[![github](https://img.shields.io/badge/GitHub-HDL_BlockSeal-blue)](https://github.com/VENOMNBB/HDL-BlockSeal)

**HDL BlockSeal** is a VS Code extension that automatically inserts the matching closing keyword whenever you press **Enter** at the end of an opening block line in a hardware description language file. It works for **Verilog**, **SystemVerilog**, and **VHDL**, respects your indentation settings, and is smart enough not to insert a duplicate if the closing keyword is already present.

---

## How it works

When you press **Enter** at the end of an opening block line, the extension:

1. Inserts a blank indented line and places your cursor there — ready to type
2. Inserts the matching closing keyword on the line below, at the correct indentation level
3. Does nothing if a matching closing keyword already exists in scope (no duplicates)

```verilog
// Before (cursor at end of line, press Enter):
module counter(input clk, output reg q);

// After:
module counter(input clk, output reg q);
    │  ← cursor, ready to type
endmodule
```

```verilog
// Before:
always @(posedge clk) begin

// After:
always @(posedge clk) begin
    │  ← cursor
end
```

```verilog
// Before (indented block):
    if (rst) begin

// After:
    if (rst) begin
        │  ← cursor, indented one level deeper
    end
```

---

## Supported languages and triggers

### Verilog and SystemVerilog

| Opening line (press Enter after) | Closing keyword inserted |
|---|---|
| `module NAME ...` | `endmodule` — at column 0 |
| `interface NAME ...` | `endinterface` — at column 0 |
| `class NAME ...` | `endclass` — at column 0 |
| `package NAME ...` | `endpackage` — at column 0 |
| `program NAME ...` | `endprogram` — at column 0 |
| `primitive NAME ...` | `endprimitive` — at column 0 |
| `config NAME ...` | `endconfig` — at column 0 |
| Any line ending in `begin` | `end` — same indent as opener |
| `fork` | `join` — same indent as opener |
| `function ...` | `endfunction` — same indent as opener |
| `task ...` | `endtask` — same indent as opener |
| `checker NAME ...` | `endchecker` — same indent as opener |
| `clocking NAME ...` | `endclocking` — same indent as opener |
| `covergroup NAME ...` | `endgroup` — same indent as opener |
| `property NAME ...` | `endproperty` — same indent as opener |
| `sequence NAME ...` | `endsequence` — same indent as opener |
| `generate` | `endgenerate` — same indent as opener |
| `specify` | `endspecify` — same indent as opener |
| `table` | `endtable` — same indent as opener |

The `begin` trigger covers every common usage pattern:

```
always @(posedge clk) begin
initial begin
if (condition) begin
else begin
else if (condition) begin
for (i = 0; i < N; i++) begin
while (condition) begin
forever begin
begin : block_label
```

### VHDL

| Opening line (press Enter after) | Closing keyword inserted |
|---|---|
| `entity NAME is` | `end entity NAME;` — at column 0 |
| `architecture NAME of ENTITY is` | `end architecture NAME;` — at column 0 |
| `package NAME is` | `end package NAME;` — at column 0 |
| `package body NAME is` | `end package body NAME;` — at column 0 |
| `configuration NAME of ENTITY is` | `end configuration NAME;` — at column 0 |
| `[LABEL :] process (...)` | `end process;` — same indent as opener |
| `[LABEL :] ... generate` | `end generate;` — same indent as opener |
| `function NAME ...` | `end function NAME;` — same indent as opener |
| `impure function NAME ...` | `end function NAME;` — same indent as opener |
| `procedure NAME ...` | `end procedure NAME;` — same indent as opener |
| `component NAME` | `end component NAME;` — same indent as opener |
| `[LABEL :] block` | `end block;` — same indent as opener |

VHDL keyword matching is case-insensitive (`ENTITY`, `entity`, and `Entity` all trigger correctly).

---

## Indentation behaviour

- **Top-level constructs** (`endmodule`, `endinterface`, `endclass`, `endpackage`, `endprogram`, `endprimitive`, `end entity`, `end architecture`, etc.) are always placed at **column 0**, regardless of how the opening line is indented.
- **Block constructs** (`end`, `endfunction`, `endtask`, `end process`, etc.) are placed at the **same indentation level as the opening line**.
- The **cursor** lands on the blank line between the opener and the closing keyword, indented one level deeper than the opener — ready to type.
- Indentation style (spaces or tabs) and tab size are read directly from your VS Code editor settings. No configuration needed.

---

## Duplicate detection

The extension tracks whether a matching closing keyword already exists in scope before inserting anything.

- For **top-level constructs**, it scans the rest of the document for the closing keyword.
- For **indented blocks**, it scans downward until it exits the current indentation scope.

This means pressing Enter on a line inside an already-complete block (or anywhere above an existing closing keyword) does nothing — no duplicates are ever inserted.

---

## Requirements

- VS Code 1.60 or later
- No internet connection required — fully local, zero runtime dependencies

---

## Installation

### From the VS Code Marketplace

Search for **HDL BlockSeal** in the Extensions panel (`Ctrl+Shift+X`) and click **Install**.

### From a `.vsix` file

1. Download the latest `.vsix` from [Releases](https://github.com/VENOMNBB/HDL-BlockSeal/releases)
2. Open the Command Palette (`Ctrl+Shift+P`) → **Extensions: Install from VSIX…** → select the file

### Build from source

```bash
git clone https://github.com/VENOMNBB/HDL-BlockSeal.git
cd HDL-BlockSeal
npm install -g @vscode/vsce
vsce package
code --install-extension hdl-blockseal-1.0.0.vsix
```

---

## Settings

All settings are under the `hdlBlockSeal` namespace and take effect immediately without reloading VS Code.

| Setting | Type | Default | Description |
|---|---|---|---|
| `hdlBlockSeal.enable` | boolean | `true` | Master switch — disabling this turns off the extension for all languages |
| `hdlBlockSeal.enableVerilog` | boolean | `true` | Enable for Verilog (`.v`) files |
| `hdlBlockSeal.enableSystemVerilog` | boolean | `true` | Enable for SystemVerilog (`.sv`, `.svh`) files |
| `hdlBlockSeal.enableVHDL` | boolean | `true` | Enable for VHDL (`.vhd`, `.vhdl`) files |

To change a setting, open **File → Preferences → Settings** and search for `hdlBlockSeal`, or add the following to your `settings.json`:

```json
{
  "hdlBlockSeal.enable": true,
  "hdlBlockSeal.enableVerilog": true,
  "hdlBlockSeal.enableSystemVerilog": true,
  "hdlBlockSeal.enableVHDL": true
}
```

---

## Known limitations

- The extension reacts to a single newline insertion at a time. Pasting multi-line text does not trigger block closing.
- Comments containing block keywords (e.g. `// module foo`) are not parsed and do not trigger the extension.
- The extension does not attempt to match opening and closing keywords across files.

---

## License

MIT — see [LICENSE](LICENSE) for details.
