import sublime
import sublime_plugin
import re


class AddNumberToTokenCommand(sublime_plugin.TextCommand):
    def run(self, edit, number):
        # Get the current cursor position
        cursor = self.view.sel()[0]

        # Check if the cursor is within a valid token
        if not self.is_valid_token(cursor):
            return

        word_region = self.view.word(cursor)
        word = self.view.substr(word_region)

        # Find the end of the word region
        end_of_word = word_region.b

        # Look for a pattern matching a number in parentheses immediately after the word
        pattern = r"\((\d+)\)"
        # Create a region that starts at the end of the word and extends to the end of the line
        line_region = self.view.line(end_of_word)
        line_text = self.view.substr(sublime.Region(end_of_word, line_region.b))

        # Search for the pattern in the line text
        match = re.search(pattern, line_text)
        if match and match.start() == 0:
            # If a match is found, calculate the start and end points of the matched text
            start = end_of_word + match.start()
            end = end_of_word + match.end()
            matched_region = sublime.Region(start, end)
            if str(number) == "0" or str(number) == match.group(1):
                self.view.replace(edit, matched_region, "")
            else:
                self.view.replace(edit, matched_region, f"({number})")
        else:
            self.view.insert(edit, word_region.end(), f"({number})")

    def is_valid_token(self, cursor):
        # Check if the cursor is within a valid token
        token_region = self.view.word(cursor)
        token = self.view.substr(token_region)
        return bool(re.match(r"\w+$", token))
