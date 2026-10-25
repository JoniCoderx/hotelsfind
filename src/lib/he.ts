// Hebrew counts: "ילד אחד", "2 ילדים".
export const adultsHe = (n: number) => (n === 1 ? 'מבוגר אחד' : `${n} מבוגרים`);
export const kidsHe = (n: number) => (n === 1 ? 'ילד אחד' : `${n} ילדים`);
export const roomsHe = (n: number) => (n === 1 ? 'חדר אחד' : `${n} חדרים`);
