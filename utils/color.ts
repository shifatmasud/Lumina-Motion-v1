export const adjustColor = (color: string, amount: number): string => {
    return '#' + color.replace(/^#/, '').match(/.{1,2}/g)!.map(c => Math.max(0, Math.min(255, parseInt(c, 16) + amount)).toString(16).padStart(2, '0')).join('');
}
