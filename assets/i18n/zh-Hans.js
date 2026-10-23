/* =====================================================================
 * assets/i18n/zh-Hans.js — the storefront's Simplified Chinese interface words (I18N-10).
 * ---------------------------------------------------------------------
 * One file per language: a page loads only its own language's words, inside the
 * bundle /assets/site-i18n-<prefix>.js that seo/site-i18n-bundle.mjs builds from
 * this file and the engine (assets/site-i18n.js). Never load this file on a page
 * by itself, and never edit a bundle: edit here, then run the locale build.
 *
 * Node (generators, tests, the localization-qa skill) reads it through the engine:
 * require('assets/site-i18n.js').DICT['zh-Hans'].
 * ================================================================== */
/* Simplified Chinese (zh-Hans), ZH-1 2026-10-22. Owner decisions: the reader is addressed with «您» (D1); prices
 * «US$12.99» (D2: Intl zh-Hans, currencyDisplay symbol); neutral Simplified Chinese with the PRC punctuation norms and
 * Apple zh-cn terms (D3); full-width punctuation ，。：；？！ and “” quotes, a space between Chinese and Latin letters or
 * digits, none around full-width punctuation (D6). Every English key, nothing else (Chinese has one plural form: `.one`
 * and `.other` are the same text). Where the English says something that is not true for phones bought in mainland China
 * («most phones released after 2019 qualify»), the Chinese says the sourced fact instead (D12, Apple 123879) — and only
 * here. AI-assisted draft held to the English facts and seo/claim-guards.mjs (zh-Hans); its quality gate is the
 * three-stage AI review (localization-qa skill). */
(function (root) {
  'use strict';
  var WORDS = {
    'nav.destinations': '目的地',
    'nav.how': '使用方法',
    'nav.tariffs': '套餐',
    'nav.guides': '指南',

    'checkout.title': '结账',
    'checkout.plan': 'eSIM 套餐',
    'checkout.coverage': '覆盖范围',
    'checkout.data': '流量',
    'checkout.term': '有效期',
    'checkout.price': '价格',
    'checkout.discount': '优惠码折扣',
    'checkout.total': '合计',
    'checkout.close': '关闭',
    'checkout.method': '支付方式',
    'checkout.promo': '优惠码',
    'checkout.promoApply': '使用',
    'checkout.promoRemove': '移除',
    'checkout.email': '接收 eSIM 的电子邮箱',
    'checkout.continue': '继续',

    'site.tagline': '出境上网，无需漫游费',
    'site.lead': '选择目的地，安装 eSIM，落地即可上网。无需实体 SIM 卡，也不用在机场排队。',
    'site.chooseCountry': '您要去哪里？',
    'site.searchPlaceholder': '国家或地区',
    'site.plansFor': '套餐：',
    'site.noPlans': '该目的地暂无套餐。',
    'site.noDestination': '没有与该名称匹配的目的地。',
    'site.allDestinations': '全部目的地',
    'site.unavailable': '暂时无法使用',
    'site.loading': '正在加载套餐…',
    'site.loadFailed': '无法加载套餐，请重试。',
    'site.pricesUnavailable': '价格暂时无法显示，请稍后再来查看。本页目前还无法下单。',
    'site.retry': '重试',
    'site.choose': '查看详情',
    'nav.compat': '设备检查',
    'how.title': '使用方法',
    'how.step1': '选择目的地和流量套餐。',
    'how.step2': '确认您的手机支持 eSIM，且未被运营商锁定。',
    'how.step3': '出发前安装 eSIM 描述文件。',
    'how.step4': '落地后开启 eSIM，即可上网。',
    /* D8: the Chinese pages never link the Russian documents. These two words are for the English documents of
     * LEGAL-0/LEGAL-1 and are shown only once seo/legal-links.mjs names a published document. */
    'footer.terms': '服务条款（英文）',
    'footer.refund': '退款政策（英文）',
    'footer.privacy': '隐私政策（英文）',
    'site.compatTitle': '我的手机能用吗？',
    'site.compatBody': '您的手机需要支持 eSIM，且未被运营商锁定。在中国大陆购买的手机，只有部分机型支持 eSIM，请先查看兼容性指南。',
    'site.compatCheck': 'iPhone 安装指南',
    'site.compatGuide': '如何检查您的手机',
    'site.compatAndroid': 'Android 安装指南',

    'price.currencyNote': '价格以美元（USD）计。本页目前还无法购买这些套餐。',

    'preview.noticeTitle': '暂不支持在线支付——目前还无法在此购买套餐',
    'preview.noticeBody': '您可以浏览套餐、获取以美元计的准确价格并完成结账流程，但目前还无法收款：不会产生任何费用，也不会创建订单或 eSIM。',
    'preview.title': '套餐详情',
    'preview.price': '价格',

    'pay.unavailableTitle': '暂不支持在线支付',
    'pay.unavailableBody': '您可以查看套餐并获取准确价格，但目前还无法收款。不会产生任何费用，也不会创建订单或 eSIM。',
    'pay.finalTitle': '暂不支持在线支付',
    'pay.finalBody': '我们目前还无法收款，因此没有产生任何费用，没有创建订单，也不会发送 eSIM。您的电子邮箱既未发送也未保存。',
    'pay.disabled': '暂不支持支付',
    'checkout.duration': '时长',
    'checkout.listed': '标价',
    'checkout.emailShort': '电子邮箱',
    'checkout.emailNote': '目前不会发送或保存到任何地方——暂不支持支付。',
    'checkout.emailInvalid': '请输入有效的电子邮箱地址。',
    'checkout.device': '我的手机支持 eSIM，且未被运营商锁定',
    'checkout.deviceRequired': '请确认您的手机支持 eSIM。',
    'consent.legend': '付款前',
    'consent.terms': '我已阅读并同意{terms}和{refund}。',
    'consent.termsLink': '服务条款',
    'consent.refundLink': '退款政策',
    'consent.delivery': '我要求 Magic eSIM 在 14 天撤回期内立即开始提供我的 eSIM 套餐。我理解，套餐一经全部提供（流量用完或有效期结束），我即丧失撤回权；如果我在此之前撤回，需要支付截至我通知时已提供部分的费用。',
    'consent.privacy': '我们的{privacy}说明了我们如何处理您的数据。',
    'consent.privacyLink': '隐私政策',
    'checkout.review': '核对',
    'checkout.back': '返回',
    'quote.explain': '准确价格由我们的服务器确定，并保留 30 分钟。',
    'quote.get': '获取准确价格',
    'quote.again': '重新获取价格',
    'quote.loading': '正在获取价格…',
    'quote.heldFor': '价格保留时间：{time}',
    'quote.expired': '此价格已过期。请重新获取价格后继续。',
    'quote.fixed': '价格已确定：{price}。',
    'quote.changed': '自列表加载以来，价格已更新。',
    'quote.unavailable': '价格暂时无法获取，请稍后再试。',
    'quote.busy': '请求过多。请稍等一分钟后再试。',
    'quote.gone': '此套餐已下架。请选择其他套餐。',
    'quote.offline': '无法连接服务器。请检查网络连接后重试。',

    'lang.ru': 'Русский',
    'lang.en': 'English',
    'lang.switchToRu': 'Перейти на русскую версию',
    'nav.findPlan': '查找套餐',
    'preview.more': '这意味着什么',
    'footer.about': '适用于 190 多个目的地的旅行 eSIM 流量套餐，价格以美元计。',
    'footer.help': '帮助',
    'home.eyebrow': '覆盖 190 多个目的地的旅行 eSIM',
    'home.h1a': '出境上网，',
    'home.h1b': '无需漫游费',
    'home.searchPlaceholder': '您要去哪里？',
    'home.find': '查找套餐',
    'home.popularShort': '热门：',
    'home.fact1': '价格以美元计',
    'home.fact2': '扫描二维码安装',
    'home.fact3': '单国、区域和每日套餐',
    'home.popularTitle': '热门目的地',
    'home.popularLead': '选择国家或地区，查看其套餐及美元价格。',
    'home.viewPlans': '查看套餐',
    'home.howKicker': '快速上手',
    'home.typesKicker': '套餐',
    'home.typesTitle': '三种套餐',
    'home.typesLead': '每个目的地页面都按相同方式对套餐分组，方便您同类比较。',
    'home.typeLocalTitle': '单国套餐',
    'home.typeLocalBody': '适用于一个国家或地区的固定流量，在固定天数内有效。',
    'home.typeRegionalTitle': '区域套餐',
    'home.typeRegionalBody': '一个套餐覆盖多个国家或地区，适合跨境旅行。每个套餐都列出其覆盖的国家和地区。',
    'home.typeDailyTitle': '每日流量',
    'home.typeDailyBody': '旅行期间每天一份流量额度，而不是整个行程共用一份。',
    'home.guidesTitle': '设置 eSIM 并排除故障',
    'home.guidesLead': '分步说明：安装、检查旅行 eSIM，以及排除故障。',
    'home.supportTitle': '出发前有疑问？',
    'home.supportBody': '请发送电子邮件联系我们的客服团队。',

    'fmt.numberLocale': 'zh-Hans',
    'fmt.currencyDisplay': 'symbol',
    'fmt.listSeparator': '、',
    'plan.badgeLocal': '单国套餐',
    'plan.badgeRegional': '区域套餐',
    'plan.badgeDaily': '每日套餐',
    'plan.daysLegend': '天数',
    'plan.gb': '{n} GB',
    'plan.dayCount.one': '{n} 天',
    'plan.dayCount.other': '{n} 天',
    'plan.country.one': '个国家/地区',
    'plan.country.other': '个国家/地区',
    'plan.coverageIncl': '{n} {countries}，包括{name}',
    'plan.coveragePlus': '{name} + {n} {countries}',
    'plan.alsoCovers': '还覆盖{names}',
    'plan.alsoCoversMore': '还覆盖{names}及另外 {n} 个',
    'plan.networks': '{n} 个网络',
    'plan.ip': 'IP：{names}',
    'plan.showAll': '显示全部 {n} 个套餐',
    'plan.showFewer': '收起部分套餐',
    'hub.noMatches': '无匹配结果',
    'hub.matches.one': '找到 {n} 个目的地',
    'hub.matches.other': '找到 {n} 个目的地'
  };
  if (typeof module === 'object' && module.exports) module.exports = WORDS;
  else (root.MagicSiteWords = root.MagicSiteWords || {})['zh-Hans'] = WORDS;
})(typeof window !== 'undefined' ? window : globalThis);
