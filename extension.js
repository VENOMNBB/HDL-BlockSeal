'use strict';
const vscode = require('vscode');

// ─────────────────────────────────────────────────────────────────────────────
// LANGUAGE DETECTION
//
// File extension is the primary and authoritative signal.
// languageId is checked only as a fallback for untitled/extensionless buffers.
// If the active file does not carry a recognised HDL extension the extension
// does nothing — regardless of what VS Code thinks the languageId is.
// ─────────────────────────────────────────────────────────────────────────────

/** Known HDL file extensions mapped to their language token. */
const EXT_MAP = {
  vhd:  'vhdl',
  vhdl: 'vhdl',
  sv:   'sv',
  svh:  'sv',
  v:    'verilog',
};

/**
 * Returns the HDL language token for the document, or null if the file is not
 * a recognised HDL file.  File extension wins; languageId is a fallback only
 * for buffers that have no extension (e.g. new untitled files).
 */
function getLang(doc) {
  // ── Primary gate: file extension ──────────────────────────────────────────
  const fileName = doc.fileName;
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex !== -1) {
    const ext = fileName.slice(dotIndex + 1).toLowerCase();
    const lang = EXT_MAP[ext];
    // Extension present but not an HDL extension → hard stop.
    return lang ?? null;
  }

  // ── Fallback: untitled / no-extension buffers ────────────────────────────
  // Only reached when the file genuinely has no extension.
  const lid = doc.languageId.toLowerCase();
  if (lid === 'vhdl')          return 'vhdl';
  if (lid === 'systemverilog') return 'sv';
  if (lid === 'verilog')       return 'verilog';
  return null;
}

function isEnabled(lang) {
  const cfg = vscode.workspace.getConfiguration('hdlBlockSeal');
  if (!cfg.get('enable'))                                    return false;
  if (lang === 'vhdl'    && !cfg.get('enableVHDL'))          return false;
  if (lang === 'sv'      && !cfg.get('enableSystemVerilog')) return false;
  if (lang === 'verilog' && !cfg.get('enableVerilog'))       return false;
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// INDENTATION HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Returns the leading whitespace of a line. */
function getIndent(lineText) {
  return lineText.match(/^(\s*)/)[1];
}

/** Returns one indentation unit (spaces or tab) from editor settings. */
function getIndentUnit(editor) {
  return editor.options.insertSpaces
    ? ' '.repeat(Number(editor.options.tabSize) || 4)
    : '\t';
}

// ─────────────────────────────────────────────────────────────────────────────
// RULE DEFINITIONS
//
// Each rule has:
//   trigger    — regex tested against the FULL trigger line text
//   getClosing — function(baseIndent, indentUnit, match) → closing line string
//   topLevel   — if true, closing keyword is always at column 0
//   skipIf     — regex: if this already exists in the relevant scope below,
//                skip insertion (avoid duplicating)
// ─────────────────────────────────────────────────────────────────────────────

const RULES_SV = [
  // ── Top-level constructs (close at column 0) ─────────────────────────────

  {
    // module foo(...);  OR  module foo
    trigger:    /^\s*(?:macro)?module\b/,
    getClosing: () => 'endmodule',
    topLevel:   true,
    skipIf:     /^\s*endmodule\b/
  },
  {
    trigger:    /^\s*primitive\b/,
    getClosing: () => 'endprimitive',
    topLevel:   true,
    skipIf:     /^\s*endprimitive\b/
  },
  {
    // interface foo  (but NOT "interface class")
    trigger:    /^\s*(?:virtual\s+)?interface\s+(?!class\b)\w+/,
    getClosing: () => 'endinterface',
    topLevel:   true,
    skipIf:     /^\s*endinterface\b/
  },
  {
    trigger:    /^\s*package\s+\w+/,
    getClosing: () => 'endpackage',
    topLevel:   true,
    skipIf:     /^\s*endpackage\b/
  },
  {
    trigger:    /^\s*program\s+\w+/,
    getClosing: () => 'endprogram',
    topLevel:   true,
    skipIf:     /^\s*endprogram\b/
  },
  {
    trigger:    /^\s*(?:virtual\s+)?class\s+\w+/,
    getClosing: () => 'endclass',
    topLevel:   true,
    skipIf:     /^\s*endclass\b/
  },
  {
    trigger:    /^\s*config\s+\w+/,
    getClosing: () => 'endconfig',
    topLevel:   true,
    skipIf:     /^\s*endconfig\b/
  },

  // ── Indented constructs ──────────────────────────────────────────────────

  {
    // begin [: label]  at end of line — covers:
    //   always @(posedge clk) begin
    //   if (condition) begin
    //   else begin
    //   for (...) begin  etc.
    trigger:    /\bbegin\s*(?::\s*\w+\s*)?$/,
    getClosing: (base) => base + 'end',
    topLevel:   false,
    skipIf:     /^\s*end\b/
  },
  {
    trigger:    /^\s*fork\b/,
    getClosing: (base) => base + 'join',
    topLevel:   false,
    skipIf:     /^\s*join\b/
  },
  {
    trigger:    /^\s*(?:(?:static|automatic|virtual|pure\s+virtual|extern)\s+)*function\b/,
    getClosing: (base) => base + 'endfunction',
    topLevel:   false,
    skipIf:     /^\s*endfunction\b/
  },
  {
    trigger:    /^\s*(?:(?:static|automatic|virtual|extern)\s+)*task\b/,
    getClosing: (base) => base + 'endtask',
    topLevel:   false,
    skipIf:     /^\s*endtask\b/
  },
  {
    trigger:    /^\s*checker\s+\w+/,
    getClosing: (base) => base + 'endchecker',
    topLevel:   false,
    skipIf:     /^\s*endchecker\b/
  },
  {
    trigger:    /^\s*clocking\s+\w+/,
    getClosing: (base) => base + 'endclocking',
    topLevel:   false,
    skipIf:     /^\s*endclocking\b/
  },
  {
    trigger:    /^\s*covergroup\s+\w+/,
    getClosing: (base) => base + 'endgroup',
    topLevel:   false,
    skipIf:     /^\s*endgroup\b/
  },
  {
    trigger:    /^\s*property\s+\w+/,
    getClosing: (base) => base + 'endproperty',
    topLevel:   false,
    skipIf:     /^\s*endproperty\b/
  },
  {
    trigger:    /^\s*sequence\s+\w+/,
    getClosing: (base) => base + 'endsequence',
    topLevel:   false,
    skipIf:     /^\s*endsequence\b/
  },
  {
    trigger:    /^\s*generate\s*$/,
    getClosing: (base) => base + 'endgenerate',
    topLevel:   false,
    skipIf:     /^\s*endgenerate\b/
  },
  {
    trigger:    /^\s*specify\s*$/,
    getClosing: (base) => base + 'endspecify',
    topLevel:   false,
    skipIf:     /^\s*endspecify\b/
  },
  {
    trigger:    /^\s*table\s*$/,
    getClosing: (base) => base + 'endtable',
    topLevel:   false,
    skipIf:     /^\s*endtable\b/
  }
];

const RULES_VHDL = [
  {
    trigger:    /^\s*entity\s+(?<name>\w+)\s+is\s*$/i,
    getClosing: (base, _unit, m) => `end entity ${m.groups.name};`,
    topLevel:   true,
    skipIf:     /^\s*end\s+entity\b/i
  },
  {
    trigger:    /^\s*architecture\s+(?<name>\w+)\s+of\s+\w+\s+is\s*$/i,
    getClosing: (base, _unit, m) => `end architecture ${m.groups.name};`,
    topLevel:   true,
    skipIf:     /^\s*end\s+architecture\b/i
  },
  {
    trigger:    /^\s*package\s+(?!body\b)(?<name>\w+)\s+is\s*$/i,
    getClosing: (base, _unit, m) => `end package ${m.groups.name};`,
    topLevel:   true,
    skipIf:     /^\s*end\s+package\b/i
  },
  {
    trigger:    /^\s*package\s+body\s+(?<name>\w+)\s+is\s*$/i,
    getClosing: (base, _unit, m) => `end package body ${m.groups.name};`,
    topLevel:   true,
    skipIf:     /^\s*end\s+package\s+body\b/i
  },
  {
    trigger:    /^\s*configuration\s+(?<name>\w+)\s+of\s+\w+\s+is\s*$/i,
    getClosing: (base, _unit, m) => `end configuration ${m.groups.name};`,
    topLevel:   true,
    skipIf:     /^\s*end\s+configuration\b/i
  },
  {
    trigger:    /\bprocess\b/i,
    getClosing: (base) => `${base}end process;`,
    topLevel:   false,
    skipIf:     /^\s*end\s+process\b/i
  },
  {
    trigger:    /\bgenerate\b\s*$/i,
    getClosing: (base) => `${base}end generate;`,
    topLevel:   false,
    skipIf:     /^\s*end\s+generate\b/i
  },
  {
    trigger:    /^\s*(?:pure\s+|impure\s+)?function\s+(?<name>\w+)/i,
    getClosing: (base, _unit, m) => `${base}end function ${m.groups.name};`,
    topLevel:   false,
    skipIf:     /^\s*end\s+function\b/i
  },
  {
    trigger:    /^\s*procedure\s+(?<name>\w+)/i,
    getClosing: (base, _unit, m) => `${base}end procedure ${m.groups.name};`,
    topLevel:   false,
    skipIf:     /^\s*end\s+procedure\b/i
  },
  {
    trigger:    /\bblock\b\s*$/i,
    getClosing: (base) => `${base}end block;`,
    topLevel:   false,
    skipIf:     /^\s*end\s+block\b/i
  },
  {
    trigger:    /^\s*component\s+(?<name>\w+)\b/i,
    getClosing: (base, _unit, m) => `${base}end component ${m.groups.name};`,
    topLevel:   false,
    skipIf:     /^\s*end\s+component\b/i
  }
];

function getRules(lang) {
  if (lang === 'vhdl') return RULES_VHDL;
  return RULES_SV; // both verilog and sv
}

// ─────────────────────────────────────────────────────────────────────────────
// SCOPE-AWARE DUPLICATE CHECK
//
// For topLevel rules: scan the whole document for the closing keyword.
// For indented rules: scan lines below the cursor until we reach a line whose
//   indentation is strictly less than baseIndent (we've exited the block).
//   Within that range, if the skipIf regex matches any line → skip insertion.
// ─────────────────────────────────────────────────────────────────────────────

function closingAlreadyExists(doc, fromLine, rule, baseIndent) {
  if (rule.topLevel) {
    // Scan entire document for the closing keyword at column 0
    for (let i = fromLine; i < doc.lineCount; i++) {
      if (rule.skipIf.test(doc.lineAt(i).text)) return true;
    }
    return false;
  }

  // Indented block: scan until we exit the block's indentation scope.
  // A line "exits the scope" when it is non-empty and indented <= baseIndent.
  const baseLen = baseIndent.length;
  for (let i = fromLine; i < doc.lineCount; i++) {
    const lineText = doc.lineAt(i).text;
    const trimmed  = lineText.trim();
    if (trimmed.length === 0) continue; // skip blank lines

    const lineIndentLen = getIndent(lineText).length;

    if (lineIndentLen <= baseLen) {
      // We have reached or passed the indentation level of the opening line.
      // Check this line — it might be the closing keyword itself.
      if (rule.skipIf.test(lineText)) return true;
      // Any other non-closing keyword at this indent means the block is open.
      break;
    }
    // Inside the block — check for the closing keyword anyway (handles
    // malformed / hand-typed files where the closing is already present)
    if (rule.skipIf.test(lineText)) return true;
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────────────────────────────────────────

function onEnter(event) {
  const doc = event.document;
  const lang = getLang(doc);
  if (!lang || !isEnabled(lang)) return;

  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document !== doc) return;

  // Only react to a single newline insertion
  if (event.contentChanges.length !== 1) return;
  const change = event.contentChanges[0];
  if (!/^\r?\n\s*$/.test(change.text)) return;

  // Derive cursorLine from the change range, not editor.selection.
  // change.range is the range *before* the insertion; its end line is the line
  // where the user pressed Enter. After insertion the new blank line is at
  // change.range.end.line + 1.
  const triggerLineN = change.range.end.line;
  const cursorLine   = triggerLineN + 1;

  if (triggerLineN < 0) return;

  const triggerText = doc.lineAt(triggerLineN).text;
  const baseIndent  = getIndent(triggerText);
  const indentUnit  = getIndentUnit(editor);
  const rules       = getRules(lang);

  for (const rule of rules) {
    const m = triggerText.match(rule.trigger);
    if (!m) continue;

    // Scope-aware duplicate check
    if (rule.skipIf && closingAlreadyExists(doc, cursorLine, rule, baseIndent)) {
      break;
    }

    // Build the two lines to insert at the current cursor position:
    //   line A → indented blank line  (cursor lands here)
    //   line B → closing keyword
    const closingIndent = rule.topLevel ? '' : baseIndent;
    const closingLine   = rule.getClosing(closingIndent, indentUnit, m);
    const cursorIndent  = baseIndent + indentUnit;

    // VS Code may have already added auto-indent whitespace on the new blank
    // line; replace the entire line content to avoid a stray extra blank line.
    const currentLineText = doc.lineAt(cursorLine).text;
    const replaceRange = new vscode.Range(
      new vscode.Position(cursorLine, 0),
      new vscode.Position(cursorLine, currentLineText.length)
    );

    editor.edit(
      editBuilder => {
        editBuilder.replace(replaceRange, cursorIndent + '\n' + closingLine);
      },
      { undoStopBefore: false, undoStopAfter: false }
    ).then(success => {
      if (!success) return;
      // Place cursor at end of the indented blank line
      const newPos = new vscode.Position(cursorLine, cursorIndent.length);
      editor.selection = new vscode.Selection(newPos, newPos);
    });

    break; // only the first matching rule fires
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVATION / DEACTIVATION
// ─────────────────────────────────────────────────────────────────────────────

function activate(context) {
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(onEnter)
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
