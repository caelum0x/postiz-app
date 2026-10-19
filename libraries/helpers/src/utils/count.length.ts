// @ts-ignore
import twitter from 'twitter-text';

export const textSlicer = (
  integrationType: string,
  end: number,
  text: string
): { start: number; end: number } => {
  if (integrationType !== 'x') {
    return {
      start: 0,
      end,
    };
  }

  const { validRangeEnd, valid } = twitter.parseTweet(text, {
    version: 3,
    maxWeightedTweetLength: end,
    scale: 100,
    defaultWeight: 200,
    emojiParsingEnabled: true,
    transformedURLLength: 23,
    ranges: [
      { start: 0, end: 4351, weight: 100 },
      { start: 8192, end: 8205, weight: 100 },
      { start: 8208, end: 8223, weight: 100 },
      { start: 8242, end: 8247, weight: 100 },
    ],
  });

  return {
    start: 0,
    end: valid ? end : validRangeEnd,
  };
};

export const weightedLength = (text: string): number => {
  return twitter.parseTweet(text).weightedLength;
};

export const countLength = (integrationType: string, text: string): number => {
  if (integrationType === 'x') {
    return weightedLength(text);
  }

  if (integrationType === 'threads') {
    // Threads counts Unicode codepoints, not UTF-8 bytes or UTF-16 code
    // units. TextEncoder().encode(text).length counted bytes (e.g. 2-4 per
    // non-ASCII character), and a plain text.length over-counts characters
    // outside the BMP (emoji, some CJK) because they are UTF-16 surrogate
    // pairs. Array.from splits on codepoints, so each character - ASCII,
    // accented, CJK or emoji - counts once.
    return Array.from(text).length;
  }

  return text.length;
};
