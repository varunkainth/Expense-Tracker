const SINGLE_EMOJI = /^(?:\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3|\p{Extended_Pictographic}\uFE0F?\p{Emoji_Modifier}?(?:\u200D\p{Extended_Pictographic}\uFE0F?\p{Emoji_Modifier}?)*)$/u;

export function isEmojiIcon(value: string | null | undefined): boolean {
  return typeof value === 'string' && SINGLE_EMOJI.test(value);
}

export function nextEmojiIcon(current: string, input: string): string {
  if (input === '' || isEmojiIcon(input)) return input;
  if (current && input.startsWith(current)) {
    const added = input.slice(current.length);
    if (isEmojiIcon(added)) return added;
  }
  if (current && input.endsWith(current)) {
    const added = input.slice(0, -current.length);
    if (isEmojiIcon(added)) return added;
  }
  return current;
}
