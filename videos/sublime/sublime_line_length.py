import sublime
import sublime_plugin
import math

enabled = False


class LineLengthDisplayCommand(sublime_plugin.TextCommand):
    def run(self, edit):
        global enabled
        self.view.erase_phantoms("lineLength")
        if enabled:
            print("Disabling")
            enabled = False
            return
        else:
            print("Enabling")
            enabled = True

        lines_number_ests = []
        group_lengths = []
        line_group_idx = 0
        for line in self.view.lines(sublime.Region(0, self.view.size())):
            line_content = self.view.substr(line).strip()
            line_length = len(line_content)
            if line_length == 0:
                line_group_idx = 0
                continue

            if line_content.startswith("+"):
                if line_group_idx >= len(group_lengths):
                    combined_length = 0
                    lines_number_ests.append(-1)
                    continue
                else:
                    lines_number_ests[-(len(group_lengths))] = 0
                    group_lengths[line_group_idx] += line_length - 1
                    combined_length = group_lengths[line_group_idx]
            else:
                if line_group_idx == 0:
                    group_lengths = []
                group_lengths.append(line_length)
                combined_length = line_length
            line_group_idx += 1

            lines_number_est = (
                math.ceil(combined_length / 55 * 10) / 10 + 0.0001
            )
            lines_number_ests.append(lines_number_est)

        line_idx = 0
        for line in self.view.lines(sublime.Region(0, self.view.size())):
            line_content = self.view.substr(line).strip()
            line_length = len(line_content)
            if line_length == 0:
                continue

            lines_number_est = lines_number_ests[line_idx]
            if lines_number_est == 0:
                line_idx += 1
                continue

            if lines_number_est > 4:
                color = "red"
            elif lines_number_est > 3:
                color = "darkblue"
            elif lines_number_est < 0:
                color = "red"
            else:
                color = "black"

            phantom_content = """
                <body id='line-length'>
                    <style>
                        p {{
                            margin: 0;
                            padding: 0 4px;
                            background-color: {};
                            color: grey;
                        }}
                    </style>
                    <p>{}</p>
                </body>
            """.format(
                color, f"{lines_number_est:.1f}"
            )
            self.view.add_phantom(
                "lineLength",
                sublime.Region(line.b),
                phantom_content,
                sublime.LAYOUT_INLINE,
            )
            line_idx += 1
