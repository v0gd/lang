from pathlib import Path
import sys
from PySide6.QtWidgets import (
    QApplication,
    QWidget,
    QVBoxLayout,
    QHBoxLayout,
    QLineEdit,
    QRadioButton,
    QLabel,
    QPushButton,
    QPlainTextEdit,
    QGroupBox,
    QGridLayout,
    QScrollArea,
    QSizePolicy,
)
from dataclasses import dataclass, field
from story_flat import SentenceFlat, StoryMultilingualFlat, parse_story


def extract_en_text(story: StoryMultilingualFlat) -> str:
    en_idx = 0
    for i, locale in enumerate(story.locales):
        if locale == "en":
            en_idx = i
            break
    text = story.titles[en_idx] + "\n\n"
    for sentence in story.sentences:
        if sentence.group_type == "/p" or sentence.group_type == "/c":
            text += "\n\n"
        text += sentence.localizations[en_idx] + " "
    return text


class StoryEditor(QWidget):
    def __init__(self, story):
        super().__init__()
        self.story = story
        self.init_ui()

    def init_ui(self):
        # Main layout
        layout = QHBoxLayout(self)

        # Edit column
        scroll_area = QScrollArea()
        scroll_area.setWidgetResizable(True)
        layout.addWidget(scroll_area, stretch=2)
        scroll_widget = QWidget()
        scroll_layout = QVBoxLayout(scroll_widget)
        scroll_area.setWidget(scroll_widget)

        # Edit title section
        edit_title_group = QGroupBox("Edit Titles")
        edit_title_layout = QGridLayout()
        edit_title_group.setLayout(edit_title_layout)
        scroll_layout.addWidget(edit_title_group)

        for i, locale in enumerate(self.story.locales):
            label = QLabel(locale)
            title_edit = QLineEdit(self.story.titles[i])
            edit_title_layout.addWidget(label, i, 0)
            edit_title_layout.addWidget(title_edit, i, 1)

        # Edit sentences section
        edit_sentences_group = QGroupBox("Edit Sentences")
        edit_sentences_layout = QVBoxLayout()
        edit_sentences_group.setLayout(edit_sentences_layout)
        scroll_layout.addWidget(edit_sentences_group)

        for i, sentence in enumerate(self.story.sentences):
            group_box = QGroupBox(f"Sentence {i}")
            group_layout = QVBoxLayout()
            group_box.setLayout(group_layout)

            # Radio buttons for group_type
            none_btn = QRadioButton("None")
            c_btn = QRadioButton("/c")
            s_btn = QRadioButton("/s")
            p_btn = QRadioButton("/p")

            none_btn.setChecked(sentence.group_type is None)
            c_btn.setChecked(sentence.group_type == "/c")
            s_btn.setChecked(sentence.group_type == "/s")
            p_btn.setChecked(sentence.group_type == "/p")

            title_radio_button_layout = QHBoxLayout()
            group_layout.addLayout(title_radio_button_layout)

            title_radio_button_layout.addWidget(none_btn)
            title_radio_button_layout.addWidget(c_btn)
            title_radio_button_layout.addWidget(s_btn)
            title_radio_button_layout.addWidget(p_btn)
            title_radio_button_layout.addStretch()

            # Group data input field
            data_edit = QLineEdit(sentence.group_data)
            group_layout.addWidget(data_edit)

            # Localization fields and play button
            for j, localization in enumerate(sentence.localizations):
                localized_sentence_layout = QHBoxLayout()
                group_layout.addLayout(localized_sentence_layout)
                loc_edit = QLineEdit(localization)
                localized_sentence_layout.addWidget(loc_edit)
                play_button = QPushButton("P")
                play_button.setFixedSize(20, 20)
                localized_sentence_layout.addWidget(play_button)

            edit_sentences_layout.addWidget(group_box)

        # Preview column
        preview_column = QVBoxLayout()
        preview_text = QPlainTextEdit(extract_en_text(self.story))
        preview_column.addWidget(preview_text)
        layout.addLayout(preview_column, stretch=1)

        self.setLayout(layout)


if __name__ == "__main__":
    test_story_path = Path(
        "/mnt/hgfs/shared/data/stories/015-beneath-paint/C1/mapping_grouped_new_format.txt"
    )
    with open(test_story_path, "r", encoding="utf-8") as file:
        all_lines = file.read().splitlines()
    parsed_story = parse_story("015-beneath-paint", all_lines)
    app = QApplication(sys.argv)
    editor = StoryEditor(parsed_story)
    editor.show()
    sys.exit(app.exec())
