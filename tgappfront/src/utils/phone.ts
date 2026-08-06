export type Country = {
  code: string;
  flag: string;
  name: string;
  mask: string;
};

export const COUNTRIES: Country[] = [
  { code: "+7", flag: "\u{1F1F7}\u{1F1FA}", name: "Россия", mask: "(999) 999-99-99" },
  { code: "+1", flag: "\u{1F1FA}\u{1F1F8}", name: "США", mask: "(999) 999-9999" },
  { code: "+44", flag: "\u{1F1EC}\u{1F1E7}", name: "Великобритания", mask: "9999 999999" },
  { code: "+49", flag: "\u{1F1E9}\u{1F1EA}", name: "Германия", mask: "999 9999999" },
  { code: "+33", flag: "\u{1F1EB}\u{1F1F7}", name: "Франция", mask: "9 99 99 99 99" },
  { code: "+90", flag: "\u{1F1F9}\u{1F1F7}", name: "Турция", mask: "(999) 999 99 99" },
  { code: "+971", flag: "\u{1F1E6}\u{1F1EA}", name: "ОАЭ", mask: "99 999 9999" },
  { code: "+380", flag: "\u{1F1FA}\u{1F1E6}", name: "Украина", mask: "(99) 999 99 99" },
  { code: "+375", flag: "\u{1F1E7}\u{1F1FE}", name: "Беларусь", mask: "(99) 999-99-99" },
  { code: "+86", flag: "\u{1F1E8}\u{1F1F3}", name: "Китай", mask: "999 9999 9999" },
  { code: "+81", flag: "\u{1F1EF}\u{1F1F5}", name: "Япония", mask: "99 9999 9999" },
  { code: "+82", flag: "\u{1F1F0}\u{1F1F7}", name: "Корея", mask: "99 9999 9999" },
  { code: "+966", flag: "\u{1F1F8}\u{1F1E6}", name: "Саудовская Аравия", mask: "99 999 9999" },
  { code: "+48", flag: "\u{1F1F5}\u{1F1F1}", name: "Польша", mask: "999 999 999" },
];

export function formatPhoneDigits(digits: string, mask: string): string {
  let result = "";
  let di = 0;
  for (let i = 0; i < mask.length && di < digits.length; i++) {
    if (mask[i] === "9") {
      result += digits[di++];
    } else {
      result += mask[i];
    }
  }
  return result;
}
