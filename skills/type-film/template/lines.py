# A narrated film's voice-over, one row per sentence: (id, gap before in s, caption text, spoken text).
# The caption text is what the viewer reads, split into caption words. The spoken text is what the voice model reads:
# for Hindi or Hinglish, write the WHOLE line in Devanagari, English words included (एग्ज़ामिनर, not "examiner").
# Latin words inside a Hindi line made Chatterbox babble on after the sentence. For English, repeat the caption text.
LANG = "en"  # "en" or "hi"
LINES = [
    ("open", 0.00, "Your answer isn't wrong.", "Your answer isn't wrong."),
    ("turn", 0.25, "It's just unreadable.", "It's just unreadable."),
]
