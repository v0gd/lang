import sublime
import sublime_plugin
import re

# [
# 	{
# 	    "keys": ["ctrl+shift+h"],
# 	    "command": "highlight_numbers"
# 	}
# ]

# Global flag to control the listener's activation
is_highlighting_active = False
token_witn_number_pattern = re.compile(r"[^\s]*\(\d+\)[^\s]*")
number_patter = re.compile(r"\((\d+)\)")

# Define your color map here
color_map = {
    "1": "region.redish",
    "2": "region.orangish",
    "3": "region.greenish",
    "4": "region.bluish",
    "5": "region.purplish",
    "6": "region.redish",
    "7": "region.orangish",
    "8": "region.greenish",
    "9": "region.bluish",
    "10": "region.purplish",
    "11": "region.cyanish",
    "12": "region.redish",
    "13": "region.orangish",
    "120": "region.cyanish",  # ok but too close
    "121": "region.pinkish",  # same as purple
    "122": "region.yellowish",  # same as orange
}

"""
"region.redish"
"region.orangish"
"region.yellowish"
"region.greenish"
"region.cyanish"
"region.bluish"
"region.purplish"
"region.pinkish"
"""


def highlight_region_if_number(view, start, end, number, row):
    if not number:
        return
    color = color_map[number]
    regions = view.get_regions(f"{row}_{number}") + [sublime.Region(start, end)]
    view.erase_regions(f"{row}_{number}")
    if int(number) < 6:
        view.add_regions(
            f"{row}_{number}", regions, color, "", sublime.DRAW_NO_OUTLINE
        )
    else:
        view.add_regions(
            f"{row}_{number}", regions, color, "", sublime.DRAW_NO_FILL
        )


def highlight_content(view, region):
    print("updating highlight")

    content = view.substr(region)
    matches = [m for m in token_witn_number_pattern.finditer(content)]
    print(f"found {len(matches)} matches out of {len(content)}")
    seq_end = -1
    seq_start = -1
    seq_row = -1
    seq_number = ""
    for match in matches:
        start = region.a + match.start() if region else match.start()
        end = region.a + match.end() if region else match.end()
        if match.group(0).startswith(" "):
            start += 1
        if match.group(0).endswith(" "):
            end -= 1
        adjusted_region = sublime.Region(start, end)
        number_match = number_patter.search(view.substr(adjusted_region))
        if number_match:
            number = str(int(number_match.group(1)) % 100)
            difficulty = int(number_match.group(1)) // 100
            if number in color_map:
                if not seq_number:
                    seq_start = start
                    seq_end = end
                    seq_number = number
                    seq_row = view.rowcol(start)[0]
                    continue

                row = view.rowcol(start)[0]
                if (
                    number == seq_number
                    and row == seq_row
                    and abs(start - seq_end) < 3
                ):
                    seq_end = end
                    continue

                highlight_region_if_number(
                    view, seq_start, seq_end, seq_number, seq_row
                )
                seq_number = number
                seq_start = start
                seq_end = end
                seq_row = row
        else:
            highlight_region_if_number(
                view, seq_start, seq_end, seq_number, seq_row
            )
            seq_number = ""
    highlight_region_if_number(view, seq_start, seq_end, seq_number, seq_row)


class HighlightNumbersCommand(sublime_plugin.TextCommand):
    def run(self, edit):
        print("Highlight is called")
        for number in color_map.keys():
            for row in range(500):
                self.view.erase_regions(f"{row}_{number}")

        global is_highlighting_active
        # Toggle the highlighting activation state
        is_highlighting_active = not is_highlighting_active
        print(f"Highlight is active: {is_highlighting_active}")
        if is_highlighting_active:
            # Apply highlighting to the entire document if activating
            highlight_content(self.view, sublime.Region(0, self.view.size()))


class AutomaticHighlightNumbersListener(sublime_plugin.EventListener):
    def on_modified_async(self, view):
        if is_highlighting_active:
            print("highlight update event")
            for sel in view.sel():
                line_region = view.line(sel)
                row = view.rowcol(line_region.a)[0]
                for number in color_map.keys():
                    view.erase_regions(f"{row}_{number}")
                highlight_content(view, line_region)
                # highlight_content(view, None)
