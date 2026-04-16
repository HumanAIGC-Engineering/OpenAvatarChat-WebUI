import { createI18n } from 'vue-i18n'
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import enUS from 'ant-design-vue/es/locale/en_US'
import { ref } from 'vue'
import en from './en'
import zh from './zh'

type SupportLocale = keyof typeof messages

export const locale = ref<SupportLocale>('zh')
export const antdLocale: Record<SupportLocale, any> = {
  zh: zhCN,
  en: enUS,
}

const messages = {
  en,
  zh,
}

const i18n = createI18n({
  legacy: false,
  locale: locale.value,
  messages,
})

export const changeLanguage = (lang: SupportLocale) => {
  locale.value = lang
  i18n.global.locale.value = lang
}

export default i18n
