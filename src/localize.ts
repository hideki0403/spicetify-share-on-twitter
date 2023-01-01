import en from './locales/en.json'
import ja from './locales/ja.json'

export default class Localize {
    constructor() {
        const currentLocale = navigator.language
        this.lang = this.availableLangs[currentLocale] ? currentLocale : 'en'
    }

    private lang: string = 'en'
    private availableLangs: Languages = {
        en,
        ja
    }

    public loc(target: string) {
        const text = this.availableLangs[this.lang][target]
        if (text) return text

        // fallback
        return this.availableLangs['en'][target] || 'Failed to get localized text'
    }
}

type Locale = {
    [key: string]: string
}

type Languages = {
    [key: string]: Locale
}