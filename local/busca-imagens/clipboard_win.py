from __future__ import annotations

import ctypes
import html
import os
import re
import threading
import time
from html.parser import HTMLParser
from typing import Any


_ALLOWED_TAGS = {
    "b",
    "blockquote",
    "br",
    "div",
    "em",
    "font",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "i",
    "li",
    "ol",
    "p",
    "s",
    "span",
    "strike",
    "strong",
    "sub",
    "sup",
    "table",
    "tbody",
    "td",
    "th",
    "tr",
    "u",
    "ul",
}
_VOID_TAGS = {"br"}
_DROP_CONTENT_TAGS = {"iframe", "object", "script", "style", "svg", "template"}
_BLOCK_TAGS = {"blockquote", "div", "h1", "h2", "h3", "h4", "h5", "h6", "li", "p", "tr"}
_FORMAT_TAGS = {"b", "strong", "i", "em", "u", "s", "strike", "sub", "sup"}
_CSS_PROPERTIES = {
    "background-color",
    "color",
    "font-family",
    "font-size",
    "font-style",
    "font-weight",
    "letter-spacing",
    "line-height",
    "text-align",
    "text-decoration",
    "vertical-align",
}
_CLIPBOARD_LOCK = threading.Lock()


def _css_color(value: str) -> str | None:
    value = value.strip().lower()
    if re.fullmatch(r"#[0-9a-f]{6}", value):
        return value
    if re.fullmatch(r"#[0-9a-f]{3}", value):
        return "#" + "".join(char * 2 for char in value[1:])
    match = re.fullmatch(r"rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)", value)
    if match and all(int(component) <= 255 for component in match.groups()):
        return "#" + "".join(f"{int(component):02x}" for component in match.groups())
    return None


def _safe_font_family(value: str) -> str | None:
    family = value.split(",", 1)[0].strip().strip("\"'")
    if 1 <= len(family) <= 80 and re.fullmatch(r"[\w -]+", family, re.UNICODE):
        return family
    return None


def _safe_css_value(property_name: str, value: str) -> str | None:
    value = value.strip()
    lowered = value.lower()
    if property_name in {"color", "background-color"}:
        return _css_color(value)
    if property_name == "font-family":
        family = _safe_font_family(value)
        return f"'{family}'" if family else None
    if property_name == "font-size":
        match = re.fullmatch(r"(\d{1,2}(?:\.\d{1,2})?)\s*(pt|px)", lowered)
        if match and 4 <= float(match.group(1)) * (0.75 if match.group(2) == "px" else 1) <= 96:
            return f"{match.group(1)}{match.group(2)}"
        return None
    if property_name == "letter-spacing":
        if lowered == "normal":
            return "normal"
        match = re.fullmatch(r"(-?\d{1,2}(?:\.\d{1,2})?)\s*(pt|px)", lowered)
        if match and abs(float(match.group(1)) * (0.75 if match.group(2) == "px" else 1)) <= 20:
            return f"{match.group(1)}{match.group(2)}"
        return None
    if property_name == "font-weight":
        if lowered in {"normal", "bold", "bolder", "lighter"} or lowered in {
            "100", "200", "300", "400", "500", "600", "700", "800", "900"
        }:
            return lowered
        return None
    if property_name == "font-style":
        return lowered if lowered in {"normal", "italic", "oblique"} else None
    if property_name == "text-decoration":
        parts = [part for part in lowered.split() if part in {"none", "underline", "line-through"}]
        return " ".join(parts) if parts else None
    if property_name == "text-align":
        return lowered if lowered in {"left", "center", "right", "justify"} else None
    if property_name == "line-height":
        match = re.fullmatch(r"(\d(?:\.\d{1,2})?)", lowered)
        if match and 0.5 <= float(match.group(1)) <= 4:
            return match.group(1)
        return None
    if property_name == "vertical-align":
        return lowered if lowered in {"baseline", "sub", "super"} else None
    return None


def _safe_styles(style: str, extra: dict[str, str] | None = None) -> dict[str, str]:
    styles: dict[str, str] = {}
    for declaration in style.split(";"):
        if ":" not in declaration:
            continue
        property_name, value = declaration.split(":", 1)
        property_name = property_name.strip().lower()
        if property_name not in _CSS_PROPERTIES:
            continue
        safe_value = _safe_css_value(property_name, value)
        if safe_value is not None:
            styles[property_name] = safe_value
    if extra:
        for property_name, value in extra.items():
            safe_value = _safe_css_value(property_name, value)
            if safe_value is not None:
                styles[property_name] = safe_value
    return styles


def sanitize_clipboard_html(fragment: str) -> str:
    """Keep a conservative set of report markup and formatting; remove active content."""

    class Sanitizer(HTMLParser):
        def __init__(self) -> None:
            super().__init__(convert_charrefs=True)
            self.output: list[str] = []
            self.stack: list[str] = []
            self.suppressed: list[str] = []

        def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
            tag = tag.lower()
            if self.suppressed:
                if tag not in _VOID_TAGS:
                    self.suppressed.append(tag)
                return
            if tag in _DROP_CONTENT_TAGS:
                self.suppressed.append(tag)
                return
            if tag not in _ALLOWED_TAGS:
                return
            attr_map = {key.lower(): value or "" for key, value in attrs}
            extra: dict[str, str] = {}
            if tag == "font":
                if attr_map.get("face"):
                    extra["font-family"] = attr_map["face"]
                if attr_map.get("color"):
                    extra["color"] = attr_map["color"]
                legacy_size = attr_map.get("size", "")
                legacy_sizes = {"1": "8pt", "2": "10pt", "3": "12pt", "4": "14pt", "5": "18pt", "6": "24pt", "7": "36pt"}
                if legacy_size in legacy_sizes:
                    extra["font-size"] = legacy_sizes[legacy_size]
            styles = _safe_styles(attr_map.get("style", ""), extra)
            style_text = ";".join(f"{name}:{value}" for name, value in styles.items())
            attr_text = f' style="{html.escape(style_text, quote=True)}"' if style_text else ""
            self.output.append(f"<{tag}{attr_text}>")
            if tag not in _VOID_TAGS:
                self.stack.append(tag)

        def handle_endtag(self, tag: str) -> None:
            tag = tag.lower()
            if self.suppressed:
                for index in range(len(self.suppressed) - 1, -1, -1):
                    if self.suppressed[index] == tag:
                        del self.suppressed[index:]
                        break
                return
            if tag not in _ALLOWED_TAGS or tag in _VOID_TAGS:
                return
            for index in range(len(self.stack) - 1, -1, -1):
                current = self.stack.pop()
                self.output.append(f"</{current}>")
                if current == tag:
                    break

        def handle_data(self, data: str) -> None:
            if not self.suppressed:
                self.output.append(html.escape(data, quote=False))

        def handle_comment(self, data: str) -> None:
            return

        def close(self) -> None:
            super().close()
            while self.stack:
                self.output.append(f"</{self.stack.pop()}>")

    sanitizer = Sanitizer()
    sanitizer.feed(fragment)
    sanitizer.close()
    return "".join(sanitizer.output)


def _rtf_escape(value: str) -> str:
    pieces: list[str] = []
    for char in value:
        codepoint = ord(char)
        if char in "{}\\":
            pieces.append("\\" + char)
        elif char == "\n":
            pieces.append("\\line ")
        elif char == "\r":
            continue
        elif codepoint < 128:
            pieces.append(char)
        else:
            encoded = char.encode("utf-16-le")
            for offset in range(0, len(encoded), 2):
                unit = int.from_bytes(encoded[offset : offset + 2], "little")
                signed = unit if unit < 32768 else unit - 65536
                pieces.append(f"\\u{signed}?")
    return "".join(pieces)


def _length_in_points(value: str | None, default: float) -> float:
    if not value:
        return default
    match = re.fullmatch(r"(-?\d{1,2}(?:\.\d{1,2})?)\s*(pt|px)", value.strip().lower())
    if not match:
        return default
    number = float(match.group(1))
    if match.group(2) == "px":
        number *= 0.75
    return number


class _RtfBuilder(HTMLParser):
    def __init__(self, default_font: str, default_size: str, default_spacing: str) -> None:
        super().__init__(convert_charrefs=True)
        family = _safe_font_family(default_font) or "Garamond"
        size = _safe_css_value("font-size", default_size) or "12pt"
        spacing = _safe_css_value("letter-spacing", default_spacing) or "normal"
        self.current: dict[str, str] = {
            "font-family": family,
            "font-size": size,
            "letter-spacing": spacing,
        }
        self.stack: list[tuple[str, dict[str, str]]] = []
        self.tokens: list[str | tuple[str, dict[str, str]]] = []
        self.suppressed: list[str] = []
        self.paragraph_has_text = False
        self.fonts: list[str] = [family]
        self.colors: list[str] = []

    def _control(self, command: str) -> None:
        self.tokens.append(command)

    def _paragraph_break(self) -> None:
        if self.paragraph_has_text:
            self._control("\\par\n")
            self.paragraph_has_text = False

    def _attrs_style(self, tag: str, attrs: list[tuple[str, str | None]]) -> dict[str, str]:
        attr_map = {key.lower(): value or "" for key, value in attrs}
        extra: dict[str, str] = {}
        if tag == "font":
            if attr_map.get("face"):
                extra["font-family"] = attr_map["face"]
            if attr_map.get("color"):
                extra["color"] = attr_map["color"]
            legacy_sizes = {"1": "8pt", "2": "10pt", "3": "12pt", "4": "14pt", "5": "18pt", "6": "24pt", "7": "36pt"}
            if attr_map.get("size") in legacy_sizes:
                extra["font-size"] = legacy_sizes[attr_map["size"]]
        return _safe_styles(attr_map.get("style", ""), extra)

    def _apply_style(self, tag: str, attrs: list[tuple[str, str | None]]) -> dict[str, str]:
        style = dict(self.current)
        if tag in {"b", "strong"}:
            style["font-weight"] = "bold"
        if tag in {"i", "em"}:
            style["font-style"] = "italic"
        if tag == "u":
            style["text-decoration"] = "underline"
        if tag in {"s", "strike"}:
            style["text-decoration"] = "line-through"
        if tag == "sub":
            style["vertical-align"] = "sub"
        if tag == "sup":
            style["vertical-align"] = "super"
        style.update(self._attrs_style(tag, attrs))
        family = _safe_font_family(style.get("font-family", ""))
        if family:
            style["font-family"] = family
            if family not in self.fonts:
                self.fonts.append(family)
        for property_name in ("color", "background-color"):
            color = _css_color(style.get(property_name, ""))
            if color:
                style[property_name] = color
                if color not in self.colors:
                    self.colors.append(color)
        return style

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        if self.suppressed:
            if tag not in _VOID_TAGS:
                self.suppressed.append(tag)
            return
        if tag in _DROP_CONTENT_TAGS:
            self.suppressed.append(tag)
            return
        if tag == "br":
            self._control("\\line ")
            self.paragraph_has_text = True
            return
        if tag in _BLOCK_TAGS or tag in {"ul", "ol", "table"}:
            self._paragraph_break()
        if tag == "li":
            self._control("\\u8226?\\tab ")
            self.paragraph_has_text = True
        if tag == "td" and self.paragraph_has_text:
            self._control("\\tab ")
        parent = dict(self.current)
        self.current = self._apply_style(tag, attrs)
        if tag not in _VOID_TAGS:
            self.stack.append((tag, parent))
        if tag in _BLOCK_TAGS:
            alignment = self.current.get("text-align")
            alignment_code = {"left": "\\ql", "center": "\\qc", "right": "\\qr", "justify": "\\qj"}.get(alignment)
            if alignment_code:
                self._control(alignment_code + " ")
            line_height = self.current.get("line-height")
            if line_height:
                self._control(f"\\sl{round(float(line_height) * 240)}\\slmult1 ")

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if self.suppressed:
            for index in range(len(self.suppressed) - 1, -1, -1):
                if self.suppressed[index] == tag:
                    del self.suppressed[index:]
                    break
            return
        if tag in _BLOCK_TAGS:
            self._paragraph_break()
        if tag in {"ul", "ol", "table"}:
            self._paragraph_break()
        for index in range(len(self.stack) - 1, -1, -1):
            stacked_tag, parent = self.stack.pop()
            self.current = parent
            if stacked_tag == tag:
                break

    def handle_data(self, data: str) -> None:
        if not self.suppressed and data:
            self.tokens.append((data, dict(self.current)))
            if data.strip():
                self.paragraph_has_text = True

    def handle_comment(self, data: str) -> None:
        return


def html_to_rtf(
    fragment: str,
    default_font: str = "Garamond",
    default_size: str = "12pt",
    default_spacing: str = "normal",
) -> str:
    safe_html = sanitize_clipboard_html(fragment)
    parser = _RtfBuilder(default_font, default_size, default_spacing)
    parser.feed(safe_html)
    parser.close()
    parser._paragraph_break()

    font_ids = {family: index for index, family in enumerate(parser.fonts)}
    color_ids = {color: index + 1 for index, color in enumerate(parser.colors)}
    font_table = "".join(
        f"{{\\f{index}\\fnil\\fcharset0 {_rtf_escape(family)};}}"
        for family, index in font_ids.items()
    )
    color_entries = ["\\red0\\green0\\blue0"]
    for color in parser.colors:
        red, green, blue = (int(color[index : index + 2], 16) for index in (1, 3, 5))
        color_entries.append(f"\\red{red}\\green{green}\\blue{blue}")
    color_table = "{\\colortbl;" + ";".join(color_entries[1:]) + (";" if len(color_entries) > 1 else "") + "}"

    body: list[str] = []
    for token in parser.tokens:
        if isinstance(token, str):
            body.append(token)
            continue
        text, style = token
        family = _safe_font_family(style.get("font-family", "")) or default_font
        family_id = font_ids.get(family, 0)
        point_size = _length_in_points(style.get("font-size"), _length_in_points(default_size, 12))
        half_points = max(8, min(192, round(point_size * 2)))
        spacing_points = _length_in_points(style.get("letter-spacing"), 0)
        spacing_twips = max(-400, min(400, round(spacing_points * 20)))
        commands = [f"\\f{family_id}", f"\\fs{half_points}"]
        if style.get("font-weight", "").lower() in {"bold", "bolder", "600", "700", "800", "900"}:
            commands.append("\\b")
        if style.get("font-style", "").lower() in {"italic", "oblique"}:
            commands.append("\\i")
        decoration = style.get("text-decoration", "").lower().split()
        if "underline" in decoration:
            commands.append("\\ul")
        if "line-through" in decoration:
            commands.append("\\strike")
        if style.get("color") in color_ids:
            commands.append(f"\\cf{color_ids[style['color']]}")
        if style.get("background-color") in color_ids:
            commands.append(f"\\highlight{color_ids[style['background-color']]}")
        if spacing_twips:
            commands.append(f"\\expndtw{spacing_twips}")
        if style.get("vertical-align") == "sub":
            commands.append("\\sub")
        elif style.get("vertical-align") == "super":
            commands.append("\\super")
        body.append("{" + "".join(commands) + " " + _rtf_escape(text) + "}")

    return "{\\rtf1\\ansi\\ansicpg1252\\deff0\\uc1{\\fonttbl" + font_table + "}" + color_table + "\\viewkind4\\pard\n" + "".join(body) + "}"


def build_cf_html(fragment: str) -> bytes:
    """Build the Windows HTML clipboard format with byte-accurate UTF-8 offsets."""
    start_marker = "<!--StartFragment-->"
    end_marker = "<!--EndFragment-->"
    document = f"<html><body>{start_marker}{fragment}{end_marker}</body></html>"
    document_bytes = document.encode("utf-8")
    header_template = (
        "Version:1.0\r\n"
        "StartHTML:{start_html:010d}\r\n"
        "EndHTML:{end_html:010d}\r\n"
        "StartFragment:{start_fragment:010d}\r\n"
        "EndFragment:{end_fragment:010d}\r\n"
    )
    blank_header = header_template.format(start_html=0, end_html=0, start_fragment=0, end_fragment=0).encode("ascii")
    start_html = len(blank_header)
    marker_start = document_bytes.index(start_marker.encode("ascii")) + len(start_marker.encode("ascii"))
    marker_end = document_bytes.index(end_marker.encode("ascii"))
    start_fragment = start_html + marker_start
    end_fragment = start_html + marker_end
    end_html = start_html + len(document_bytes)
    header = header_template.format(
        start_html=start_html,
        end_html=end_html,
        start_fragment=start_fragment,
        end_fragment=end_fragment,
    ).encode("ascii")
    return header + document_bytes


def _global_handle(kernel32: Any, data: bytes) -> int:
    handle = kernel32.GlobalAlloc(0x0002, len(data))  # GMEM_MOVEABLE
    if not handle:
        raise OSError("Não foi possível reservar memória para o clipboard.")
    pointer = kernel32.GlobalLock(handle)
    if not pointer:
        kernel32.GlobalFree(handle)
        raise OSError("Não foi possível preparar os dados do clipboard.")
    try:
        ctypes.memmove(pointer, data, len(data))
    finally:
        kernel32.GlobalUnlock(handle)
    return handle


def write_windows_clipboard(html_fragment: str, plain_text: str, rtf_text: str) -> None:
    """Write RTF, CF_HTML and Unicode text to the current Windows user's clipboard."""
    if os.name != "nt":
        raise OSError("A gravação no clipboard nativo está disponível somente no Windows.")

    user32 = ctypes.WinDLL("user32", use_last_error=True)
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    user32.OpenClipboard.argtypes = [ctypes.c_void_p]
    user32.OpenClipboard.restype = ctypes.c_bool
    user32.EmptyClipboard.argtypes = []
    user32.EmptyClipboard.restype = ctypes.c_bool
    user32.CloseClipboard.argtypes = []
    user32.CloseClipboard.restype = ctypes.c_bool
    user32.RegisterClipboardFormatW.argtypes = [ctypes.c_wchar_p]
    user32.RegisterClipboardFormatW.restype = ctypes.c_uint
    user32.SetClipboardData.argtypes = [ctypes.c_uint, ctypes.c_void_p]
    user32.SetClipboardData.restype = ctypes.c_void_p
    kernel32.GlobalAlloc.argtypes = [ctypes.c_uint, ctypes.c_size_t]
    kernel32.GlobalAlloc.restype = ctypes.c_void_p
    kernel32.GlobalLock.argtypes = [ctypes.c_void_p]
    kernel32.GlobalLock.restype = ctypes.c_void_p
    kernel32.GlobalUnlock.argtypes = [ctypes.c_void_p]
    kernel32.GlobalUnlock.restype = ctypes.c_bool
    kernel32.GlobalFree.argtypes = [ctypes.c_void_p]
    kernel32.GlobalFree.restype = ctypes.c_void_p

    formats = [
        (13, plain_text.encode("utf-16-le") + b"\0\0"),  # CF_UNICODETEXT
        (user32.RegisterClipboardFormatW("HTML Format"), build_cf_html(sanitize_clipboard_html(html_fragment))),
        (user32.RegisterClipboardFormatW("Rich Text Format"), rtf_text.encode("ascii", errors="strict")),
    ]
    if any(format_id == 0 for format_id, _ in formats):
        raise OSError("O Windows não conseguiu registrar um formato de clipboard.")

    with _CLIPBOARD_LOCK:
        allocated: list[tuple[int, int]] = []
        transferred: set[int] = set()
        opened = False
        try:
            for format_id, data in formats:
                allocated.append((format_id, _global_handle(kernel32, data)))
            for _ in range(12):
                if user32.OpenClipboard(None):
                    opened = True
                    break
                time.sleep(0.05)
            if not opened:
                raise OSError("O clipboard do Windows está ocupado. Tente novamente.")
            if not user32.EmptyClipboard():
                raise OSError("Não foi possível atualizar o clipboard do Windows.")
            for format_id, handle in allocated:
                if not user32.SetClipboardData(format_id, handle):
                    raise OSError("O Windows recusou um formato do clipboard.")
                transferred.add(handle)
        finally:
            if opened:
                user32.CloseClipboard()
            for _, handle in allocated:
                if handle not in transferred:
                    kernel32.GlobalFree(handle)
