// Country names in the five planned languages — DATA ONLY (I18N-03).
//
// ru and en stay where they always were, in seo/country-names.mjs (with the
// Russian genitive and the URL slug). This table adds es, de, fr, zh-Hans and
// ko for the SAME 234 codes; `seo/test-country-names-i18n.mjs` fails if either
// table gains or loses a code without the other.
//
// WHY A SEPARATE FILE. country-names.mjs is read by eight generators and by the
// catalogue workflow's `--check`; every byte they produce is live. A table no
// generator imports cannot change a page, and that is this stage's promise:
// nothing here is rendered, linked or shipped to a browser until the stage that
// enables a language reads it (the test pins that no generator, page or script
// imports this file yet).
//
// WHERE THE NAMES COME FROM. Unicode CLDR 48 (via ICU 78.2 in Node 24.15,
// `Intl.DisplayNames`, type region), generated once on 2026-10-13 and committed
// as data — never regenerated at build time, so a different ICU on another
// machine cannot move a name silently. CLDR's names were then overridden where
// they contradict a choice our English names already make:
//   AN  CLDR maps the retired code to Curaçao (CW has its own entry) → the
//       Netherlands Antilles, as our EN says.
//   HK, MO  CLDR's long «SAR China» forms → the short common names our EN uses
//       (zh-Hans: 中国香港 / 中国澳门).
//   MM  «Myanmar (Birmania/Birmanie)» → Myanmar, as our EN.
//   CD, CG  CLDR's «Kinshasa/Brazzaville» forms → the full state names, matching
//       our EN «DR Congo» / «Republic of the Congo».
//   SX  fr «Saint-Martin (partie néerlandaise)» → Sint Maarten, as our EN (no hyphen — the Dutch name, as es/de;
//       localization QA 2026-10-22).
//   CI  es «Côte d’Ivoire» (CLDR keeps the French official form) → «Costa de Marfil», the name every Spanish speaker
//       uses and searches (RAE / Fundéu); found by localization QA 2026-10-21. de and fr keep CLDR's.
//   ZA, CF, DO  ko «남아프리카» (reads as the region «southern Africa») → «남아프리카 공화국»; «중앙 아프리카 공화국» →
//       «중앙아프리카공화국», «도미니카 공화국» → «도미니카공화국» — the forms of the Korean Ministry of Foreign Affairs
//       (owner D5, KO-1 2026-10-22).
//   AE  zh-Hans «阿拉伯联合酋长国» (CLDR's full state name) → «阿联酋», the short name Chinese readers use and search,
//       as our EN «United Arab Emirates» is the common name (owner D5, ZH-1 2026-10-22).
//   SZ  zh-Hans «斯威士兰» (CLDR's pre-2018 name) → «埃斯瓦蒂尼», the current name, as our EN «Eswatini» (owner D5).
//   VC  fr «Saint-Vincent-et-les Grenadines» (CLDR) → «Saint-Vincent-et-les-Grenadines», the official French name with
//       its hyphens; found by localization QA 2026-10-22.
//   KT  not in CLDR (not an ISO 3166 code — the provider's code for Northern
//       Cyprus, 2026-10-18); the five names were written here, as data.
// AI-assisted data: a native-speaker review is part of enabling each language
// (plan §2.5), not of this stage.
import { COUNTRY_NAMES } from './country-names.mjs';

/** The languages this table holds, in registry order (seo/locales.mjs). */
export const I18N_COUNTRY_LANGS = Object.freeze(['es', 'de', 'fr', 'zh-Hans', 'ko']);

export const COUNTRY_NAMES_I18N = Object.freeze({
  AD: { es: "Andorra", de: "Andorra", fr: "Andorre", "zh-Hans": "安道尔", ko: "안도라" },
  AE: { es: "Emiratos Árabes Unidos", de: "Vereinigte Arabische Emirate", fr: "Émirats arabes unis", "zh-Hans": "阿联酋", ko: "아랍에미리트" },
  AF: { es: "Afganistán", de: "Afghanistan", fr: "Afghanistan", "zh-Hans": "阿富汗", ko: "아프가니스탄" },
  AG: { es: "Antigua y Barbuda", de: "Antigua und Barbuda", fr: "Antigua-et-Barbuda", "zh-Hans": "安提瓜和巴布达", ko: "앤티가 바부다" },
  AI: { es: "Anguila", de: "Anguilla", fr: "Anguilla", "zh-Hans": "安圭拉", ko: "앵귈라" },
  AN: { es: "Antillas Neerlandesas", de: "Niederländische Antillen", fr: "Antilles néerlandaises", "zh-Hans": "荷属安的列斯", ko: "네덜란드령 안틸레스" },
  AL: { es: "Albania", de: "Albanien", fr: "Albanie", "zh-Hans": "阿尔巴尼亚", ko: "알바니아" },
  AM: { es: "Armenia", de: "Armenien", fr: "Arménie", "zh-Hans": "亚美尼亚", ko: "아르메니아" },
  AO: { es: "Angola", de: "Angola", fr: "Angola", "zh-Hans": "安哥拉", ko: "앙골라" },
  AR: { es: "Argentina", de: "Argentinien", fr: "Argentine", "zh-Hans": "阿根廷", ko: "아르헨티나" },
  AS: { es: "Samoa Americana", de: "Amerikanisch-Samoa", fr: "Samoa américaines", "zh-Hans": "美属萨摩亚", ko: "아메리칸 사모아" },
  AT: { es: "Austria", de: "Österreich", fr: "Autriche", "zh-Hans": "奥地利", ko: "오스트리아" },
  AU: { es: "Australia", de: "Australien", fr: "Australie", "zh-Hans": "澳大利亚", ko: "오스트레일리아" },
  AW: { es: "Aruba", de: "Aruba", fr: "Aruba", "zh-Hans": "阿鲁巴", ko: "아루바" },
  AX: { es: "Islas Aland", de: "Ålandinseln", fr: "Îles Åland", "zh-Hans": "奥兰群岛", ko: "올란드 제도" },
  AZ: { es: "Azerbaiyán", de: "Aserbaidschan", fr: "Azerbaïdjan", "zh-Hans": "阿塞拜疆", ko: "아제르바이잔" },
  BA: { es: "Bosnia y Herzegovina", de: "Bosnien und Herzegowina", fr: "Bosnie-Herzégovine", "zh-Hans": "波斯尼亚和黑塞哥维那", ko: "보스니아 헤르체고비나" },
  BB: { es: "Barbados", de: "Barbados", fr: "Barbade", "zh-Hans": "巴巴多斯", ko: "바베이도스" },
  BD: { es: "Bangladés", de: "Bangladesch", fr: "Bangladesh", "zh-Hans": "孟加拉国", ko: "방글라데시" },
  BE: { es: "Bélgica", de: "Belgien", fr: "Belgique", "zh-Hans": "比利时", ko: "벨기에" },
  BF: { es: "Burkina Faso", de: "Burkina Faso", fr: "Burkina Faso", "zh-Hans": "布基纳法索", ko: "부르키나파소" },
  BG: { es: "Bulgaria", de: "Bulgarien", fr: "Bulgarie", "zh-Hans": "保加利亚", ko: "불가리아" },
  BH: { es: "Baréin", de: "Bahrain", fr: "Bahreïn", "zh-Hans": "巴林", ko: "바레인" },
  BI: { es: "Burundi", de: "Burundi", fr: "Burundi", "zh-Hans": "布隆迪", ko: "부룬디" },
  BJ: { es: "Benín", de: "Benin", fr: "Bénin", "zh-Hans": "贝宁", ko: "베냉" },
  BL: { es: "San Bartolomé", de: "St. Barthélemy", fr: "Saint-Barthélemy", "zh-Hans": "圣巴泰勒米", ko: "생바르텔레미" },
  BM: { es: "Bermudas", de: "Bermuda", fr: "Bermudes", "zh-Hans": "百慕大", ko: "버뮤다" },
  BN: { es: "Brunéi", de: "Brunei Darussalam", fr: "Brunei", "zh-Hans": "文莱", ko: "브루나이" },
  BO: { es: "Bolivia", de: "Bolivien", fr: "Bolivie", "zh-Hans": "玻利维亚", ko: "볼리비아" },
  BQ: { es: "Caribe neerlandés", de: "Karibische Niederlande", fr: "Pays-Bas caribéens", "zh-Hans": "荷属加勒比区", ko: "네덜란드령 카리브" },
  BR: { es: "Brasil", de: "Brasilien", fr: "Brésil", "zh-Hans": "巴西", ko: "브라질" },
  BS: { es: "Bahamas", de: "Bahamas", fr: "Bahamas", "zh-Hans": "巴哈马", ko: "바하마" },
  BT: { es: "Bután", de: "Bhutan", fr: "Bhoutan", "zh-Hans": "不丹", ko: "부탄" },
  BW: { es: "Botsuana", de: "Botsuana", fr: "Botswana", "zh-Hans": "博茨瓦纳", ko: "보츠와나" },
  BY: { es: "Bielorrusia", de: "Belarus", fr: "Biélorussie", "zh-Hans": "白俄罗斯", ko: "벨라루스" },
  BZ: { es: "Belice", de: "Belize", fr: "Belize", "zh-Hans": "伯利兹", ko: "벨리즈" },
  CA: { es: "Canadá", de: "Kanada", fr: "Canada", "zh-Hans": "加拿大", ko: "캐나다" },
  CD: { es: "República Democrática del Congo", de: "Demokratische Republik Kongo", fr: "République démocratique du Congo", "zh-Hans": "刚果民主共和国", ko: "콩고민주공화국" },
  CF: { es: "República Centroafricana", de: "Zentralafrikanische Republik", fr: "République centrafricaine", "zh-Hans": "中非共和国", ko: "중앙아프리카공화국" },
  CG: { es: "República del Congo", de: "Republik Kongo", fr: "République du Congo", "zh-Hans": "刚果共和国", ko: "콩고공화국" },
  CH: { es: "Suiza", de: "Schweiz", fr: "Suisse", "zh-Hans": "瑞士", ko: "스위스" },
  CI: { es: "Costa de Marfil", de: "Côte d’Ivoire", fr: "Côte d’Ivoire", "zh-Hans": "科特迪瓦", ko: "코트디부아르" },
  CK: { es: "Islas Cook", de: "Cookinseln", fr: "Îles Cook", "zh-Hans": "库克群岛", ko: "쿡 제도" },
  CL: { es: "Chile", de: "Chile", fr: "Chili", "zh-Hans": "智利", ko: "칠레" },
  CM: { es: "Camerún", de: "Kamerun", fr: "Cameroun", "zh-Hans": "喀麦隆", ko: "카메룬" },
  CN: { es: "China", de: "China", fr: "Chine", "zh-Hans": "中国", ko: "중국" },
  CO: { es: "Colombia", de: "Kolumbien", fr: "Colombie", "zh-Hans": "哥伦比亚", ko: "콜롬비아" },
  CR: { es: "Costa Rica", de: "Costa Rica", fr: "Costa Rica", "zh-Hans": "哥斯达黎加", ko: "코스타리카" },
  CU: { es: "Cuba", de: "Kuba", fr: "Cuba", "zh-Hans": "古巴", ko: "쿠바" },
  CV: { es: "Cabo Verde", de: "Cabo Verde", fr: "Cap-Vert", "zh-Hans": "佛得角", ko: "카보베르데" },
  CW: { es: "Curazao", de: "Curaçao", fr: "Curaçao", "zh-Hans": "库拉索", ko: "퀴라소" },
  CY: { es: "Chipre", de: "Zypern", fr: "Chypre", "zh-Hans": "塞浦路斯", ko: "키프로스" },
  CZ: { es: "Chequia", de: "Tschechien", fr: "Tchéquie", "zh-Hans": "捷克", ko: "체코" },
  DE: { es: "Alemania", de: "Deutschland", fr: "Allemagne", "zh-Hans": "德国", ko: "독일" },
  DJ: { es: "Yibuti", de: "Dschibuti", fr: "Djibouti", "zh-Hans": "吉布提", ko: "지부티" },
  DK: { es: "Dinamarca", de: "Dänemark", fr: "Danemark", "zh-Hans": "丹麦", ko: "덴마크" },
  DM: { es: "Dominica", de: "Dominica", fr: "Dominique", "zh-Hans": "多米尼克", ko: "도미니카" },
  DO: { es: "República Dominicana", de: "Dominikanische Republik", fr: "République dominicaine", "zh-Hans": "多米尼加共和国", ko: "도미니카공화국" },
  DZ: { es: "Argelia", de: "Algerien", fr: "Algérie", "zh-Hans": "阿尔及利亚", ko: "알제리" },
  EC: { es: "Ecuador", de: "Ecuador", fr: "Équateur", "zh-Hans": "厄瓜多尔", ko: "에콰도르" },
  EE: { es: "Estonia", de: "Estland", fr: "Estonie", "zh-Hans": "爱沙尼亚", ko: "에스토니아" },
  EG: { es: "Egipto", de: "Ägypten", fr: "Égypte", "zh-Hans": "埃及", ko: "이집트" },
  ER: { es: "Eritrea", de: "Eritrea", fr: "Érythrée", "zh-Hans": "厄立特里亚", ko: "에리트리아" },
  ES: { es: "España", de: "Spanien", fr: "Espagne", "zh-Hans": "西班牙", ko: "스페인" },
  ET: { es: "Etiopía", de: "Äthiopien", fr: "Éthiopie", "zh-Hans": "埃塞俄比亚", ko: "에티오피아" },
  FI: { es: "Finlandia", de: "Finnland", fr: "Finlande", "zh-Hans": "芬兰", ko: "핀란드" },
  FJ: { es: "Fiyi", de: "Fidschi", fr: "Fidji", "zh-Hans": "斐济", ko: "피지" },
  FK: { es: "Islas Malvinas", de: "Falklandinseln", fr: "Îles Malouines", "zh-Hans": "福克兰群岛", ko: "포클랜드 제도" },
  FM: { es: "Micronesia", de: "Mikronesien", fr: "Micronésie", "zh-Hans": "密克罗尼西亚", ko: "미크로네시아" },
  FO: { es: "Islas Feroe", de: "Färöer", fr: "Îles Féroé", "zh-Hans": "法罗群岛", ko: "페로 제도" },
  FR: { es: "Francia", de: "Frankreich", fr: "France", "zh-Hans": "法国", ko: "프랑스" },
  GA: { es: "Gabón", de: "Gabun", fr: "Gabon", "zh-Hans": "加蓬", ko: "가봉" },
  GB: { es: "Reino Unido", de: "Vereinigtes Königreich", fr: "Royaume-Uni", "zh-Hans": "英国", ko: "영국" },
  GD: { es: "Granada", de: "Grenada", fr: "Grenade", "zh-Hans": "格林纳达", ko: "그레나다" },
  GE: { es: "Georgia", de: "Georgien", fr: "Géorgie", "zh-Hans": "格鲁吉亚", ko: "조지아" },
  GF: { es: "Guayana Francesa", de: "Französisch-Guayana", fr: "Guyane française", "zh-Hans": "法属圭亚那", ko: "프랑스령 기아나" },
  GG: { es: "Guernesey", de: "Guernsey", fr: "Guernesey", "zh-Hans": "根西岛", ko: "건지" },
  GH: { es: "Ghana", de: "Ghana", fr: "Ghana", "zh-Hans": "加纳", ko: "가나" },
  GI: { es: "Gibraltar", de: "Gibraltar", fr: "Gibraltar", "zh-Hans": "直布罗陀", ko: "지브롤터" },
  GL: { es: "Groenlandia", de: "Grönland", fr: "Groenland", "zh-Hans": "格陵兰", ko: "그린란드" },
  GM: { es: "Gambia", de: "Gambia", fr: "Gambie", "zh-Hans": "冈比亚", ko: "감비아" },
  GN: { es: "Guinea", de: "Guinea", fr: "Guinée", "zh-Hans": "几内亚", ko: "기니" },
  GP: { es: "Guadalupe", de: "Guadeloupe", fr: "Guadeloupe", "zh-Hans": "瓜德罗普", ko: "과들루프" },
  GQ: { es: "Guinea Ecuatorial", de: "Äquatorialguinea", fr: "Guinée équatoriale", "zh-Hans": "赤道几内亚", ko: "적도 기니" },
  GR: { es: "Grecia", de: "Griechenland", fr: "Grèce", "zh-Hans": "希腊", ko: "그리스" },
  GT: { es: "Guatemala", de: "Guatemala", fr: "Guatemala", "zh-Hans": "危地马拉", ko: "과테말라" },
  GU: { es: "Guam", de: "Guam", fr: "Guam", "zh-Hans": "关岛", ko: "괌" },
  GW: { es: "Guinea-Bisáu", de: "Guinea-Bissau", fr: "Guinée-Bissau", "zh-Hans": "几内亚比绍", ko: "기니비사우" },
  GY: { es: "Guyana", de: "Guyana", fr: "Guyana", "zh-Hans": "圭亚那", ko: "가이아나" },
  HK: { es: "Hong Kong", de: "Hongkong", fr: "Hong Kong", "zh-Hans": "中国香港", ko: "홍콩" },
  HN: { es: "Honduras", de: "Honduras", fr: "Honduras", "zh-Hans": "洪都拉斯", ko: "온두라스" },
  HR: { es: "Croacia", de: "Kroatien", fr: "Croatie", "zh-Hans": "克罗地亚", ko: "크로아티아" },
  HT: { es: "Haití", de: "Haiti", fr: "Haïti", "zh-Hans": "海地", ko: "아이티" },
  HU: { es: "Hungría", de: "Ungarn", fr: "Hongrie", "zh-Hans": "匈牙利", ko: "헝가리" },
  ID: { es: "Indonesia", de: "Indonesien", fr: "Indonésie", "zh-Hans": "印度尼西亚", ko: "인도네시아" },
  IE: { es: "Irlanda", de: "Irland", fr: "Irlande", "zh-Hans": "爱尔兰", ko: "아일랜드" },
  IL: { es: "Israel", de: "Israel", fr: "Israël", "zh-Hans": "以色列", ko: "이스라엘" },
  IM: { es: "Isla de Man", de: "Isle of Man", fr: "Île de Man", "zh-Hans": "马恩岛", ko: "맨섬" },
  IN: { es: "India", de: "Indien", fr: "Inde", "zh-Hans": "印度", ko: "인도" },
  IQ: { es: "Irak", de: "Irak", fr: "Irak", "zh-Hans": "伊拉克", ko: "이라크" },
  IR: { es: "Irán", de: "Iran", fr: "Iran", "zh-Hans": "伊朗", ko: "이란" },
  IS: { es: "Islandia", de: "Island", fr: "Islande", "zh-Hans": "冰岛", ko: "아이슬란드" },
  IT: { es: "Italia", de: "Italien", fr: "Italie", "zh-Hans": "意大利", ko: "이탈리아" },
  JE: { es: "Jersey", de: "Jersey", fr: "Jersey", "zh-Hans": "泽西岛", ko: "저지" },
  JM: { es: "Jamaica", de: "Jamaika", fr: "Jamaïque", "zh-Hans": "牙买加", ko: "자메이카" },
  JO: { es: "Jordania", de: "Jordanien", fr: "Jordanie", "zh-Hans": "约旦", ko: "요르단" },
  JP: { es: "Japón", de: "Japan", fr: "Japon", "zh-Hans": "日本", ko: "일본" },
  KE: { es: "Kenia", de: "Kenia", fr: "Kenya", "zh-Hans": "肯尼亚", ko: "케냐" },
  KG: { es: "Kirguistán", de: "Kirgisistan", fr: "Kirghizstan", "zh-Hans": "吉尔吉斯斯坦", ko: "키르기스스탄" },
  KH: { es: "Camboya", de: "Kambodscha", fr: "Cambodge", "zh-Hans": "柬埔寨", ko: "캄보디아" },
  KI: { es: "Kiribati", de: "Kiribati", fr: "Kiribati", "zh-Hans": "基里巴斯", ko: "키리바시" },
  KM: { es: "Comoras", de: "Komoren", fr: "Comores", "zh-Hans": "科摩罗", ko: "코모로" },
  KN: { es: "San Cristóbal y Nieves", de: "St. Kitts und Nevis", fr: "Saint-Christophe-et-Niévès", "zh-Hans": "圣基茨和尼维斯", ko: "세인트키츠 네비스" },
  KR: { es: "Corea del Sur", de: "Südkorea", fr: "Corée du Sud", "zh-Hans": "韩国", ko: "대한민국" },
  KT: { es: "Chipre del Norte", de: "Nordzypern", fr: "Chypre du Nord", "zh-Hans": "北塞浦路斯", ko: "북키프로스" },
  KW: { es: "Kuwait", de: "Kuwait", fr: "Koweït", "zh-Hans": "科威特", ko: "쿠웨이트" },
  KY: { es: "Islas Caimán", de: "Kaimaninseln", fr: "Îles Caïmans", "zh-Hans": "开曼群岛", ko: "케이맨 제도" },
  KZ: { es: "Kazajistán", de: "Kasachstan", fr: "Kazakhstan", "zh-Hans": "哈萨克斯坦", ko: "카자흐스탄" },
  LA: { es: "Laos", de: "Laos", fr: "Laos", "zh-Hans": "老挝", ko: "라오스" },
  LB: { es: "Líbano", de: "Libanon", fr: "Liban", "zh-Hans": "黎巴嫩", ko: "레바논" },
  LC: { es: "Santa Lucía", de: "St. Lucia", fr: "Sainte-Lucie", "zh-Hans": "圣卢西亚", ko: "세인트루시아" },
  LI: { es: "Liechtenstein", de: "Liechtenstein", fr: "Liechtenstein", "zh-Hans": "列支敦士登", ko: "리히텐슈타인" },
  LK: { es: "Sri Lanka", de: "Sri Lanka", fr: "Sri Lanka", "zh-Hans": "斯里兰卡", ko: "스리랑카" },
  LR: { es: "Liberia", de: "Liberia", fr: "Liberia", "zh-Hans": "利比里亚", ko: "라이베리아" },
  LS: { es: "Lesoto", de: "Lesotho", fr: "Lesotho", "zh-Hans": "莱索托", ko: "레소토" },
  LT: { es: "Lituania", de: "Litauen", fr: "Lituanie", "zh-Hans": "立陶宛", ko: "리투아니아" },
  LU: { es: "Luxemburgo", de: "Luxemburg", fr: "Luxembourg", "zh-Hans": "卢森堡", ko: "룩셈부르크" },
  LV: { es: "Letonia", de: "Lettland", fr: "Lettonie", "zh-Hans": "拉脱维亚", ko: "라트비아" },
  LY: { es: "Libia", de: "Libyen", fr: "Libye", "zh-Hans": "利比亚", ko: "리비아" },
  MA: { es: "Marruecos", de: "Marokko", fr: "Maroc", "zh-Hans": "摩洛哥", ko: "모로코" },
  MC: { es: "Mónaco", de: "Monaco", fr: "Monaco", "zh-Hans": "摩纳哥", ko: "모나코" },
  MD: { es: "Moldavia", de: "Republik Moldau", fr: "Moldavie", "zh-Hans": "摩尔多瓦", ko: "몰도바" },
  ME: { es: "Montenegro", de: "Montenegro", fr: "Monténégro", "zh-Hans": "黑山", ko: "몬테네그로" },
  MF: { es: "San Martín", de: "St. Martin", fr: "Saint-Martin", "zh-Hans": "法属圣马丁", ko: "생마르탱" },
  MG: { es: "Madagascar", de: "Madagaskar", fr: "Madagascar", "zh-Hans": "马达加斯加", ko: "마다가스카르" },
  MH: { es: "Islas Marshall", de: "Marshallinseln", fr: "Îles Marshall", "zh-Hans": "马绍尔群岛", ko: "마셜 제도" },
  MK: { es: "Macedonia del Norte", de: "Nordmazedonien", fr: "Macédoine du Nord", "zh-Hans": "北马其顿", ko: "북마케도니아" },
  ML: { es: "Mali", de: "Mali", fr: "Mali", "zh-Hans": "马里", ko: "말리" },
  MM: { es: "Myanmar", de: "Myanmar", fr: "Myanmar", "zh-Hans": "缅甸", ko: "미얀마" },
  MN: { es: "Mongolia", de: "Mongolei", fr: "Mongolie", "zh-Hans": "蒙古", ko: "몽골" },
  MO: { es: "Macao", de: "Macau", fr: "Macao", "zh-Hans": "中国澳门", ko: "마카오" },
  MP: { es: "Islas Marianas del Norte", de: "Nördliche Marianen", fr: "Îles Mariannes du Nord", "zh-Hans": "北马里亚纳群岛", ko: "북마리아나제도" },
  MQ: { es: "Martinica", de: "Martinique", fr: "Martinique", "zh-Hans": "马提尼克", ko: "마르티니크" },
  MR: { es: "Mauritania", de: "Mauretanien", fr: "Mauritanie", "zh-Hans": "毛里塔尼亚", ko: "모리타니" },
  MS: { es: "Montserrat", de: "Montserrat", fr: "Montserrat", "zh-Hans": "蒙特塞拉特", ko: "몬트세라트" },
  MT: { es: "Malta", de: "Malta", fr: "Malte", "zh-Hans": "马耳他", ko: "몰타" },
  MU: { es: "Mauricio", de: "Mauritius", fr: "Maurice", "zh-Hans": "毛里求斯", ko: "모리셔스" },
  MV: { es: "Maldivas", de: "Malediven", fr: "Maldives", "zh-Hans": "马尔代夫", ko: "몰디브" },
  MW: { es: "Malaui", de: "Malawi", fr: "Malawi", "zh-Hans": "马拉维", ko: "말라위" },
  MX: { es: "México", de: "Mexiko", fr: "Mexique", "zh-Hans": "墨西哥", ko: "멕시코" },
  MY: { es: "Malasia", de: "Malaysia", fr: "Malaisie", "zh-Hans": "马来西亚", ko: "말레이시아" },
  MZ: { es: "Mozambique", de: "Mosambik", fr: "Mozambique", "zh-Hans": "莫桑比克", ko: "모잠비크" },
  NA: { es: "Namibia", de: "Namibia", fr: "Namibie", "zh-Hans": "纳米比亚", ko: "나미비아" },
  NC: { es: "Nueva Caledonia", de: "Neukaledonien", fr: "Nouvelle-Calédonie", "zh-Hans": "新喀里多尼亚", ko: "뉴칼레도니아" },
  NE: { es: "Níger", de: "Niger", fr: "Niger", "zh-Hans": "尼日尔", ko: "니제르" },
  NG: { es: "Nigeria", de: "Nigeria", fr: "Nigeria", "zh-Hans": "尼日利亚", ko: "나이지리아" },
  NI: { es: "Nicaragua", de: "Nicaragua", fr: "Nicaragua", "zh-Hans": "尼加拉瓜", ko: "니카라과" },
  NL: { es: "Países Bajos", de: "Niederlande", fr: "Pays-Bas", "zh-Hans": "荷兰", ko: "네덜란드" },
  NO: { es: "Noruega", de: "Norwegen", fr: "Norvège", "zh-Hans": "挪威", ko: "노르웨이" },
  NP: { es: "Nepal", de: "Nepal", fr: "Népal", "zh-Hans": "尼泊尔", ko: "네팔" },
  NR: { es: "Nauru", de: "Nauru", fr: "Nauru", "zh-Hans": "瑙鲁", ko: "나우루" },
  NU: { es: "Niue", de: "Niue", fr: "Niue", "zh-Hans": "纽埃", ko: "니우에" },
  NZ: { es: "Nueva Zelanda", de: "Neuseeland", fr: "Nouvelle-Zélande", "zh-Hans": "新西兰", ko: "뉴질랜드" },
  OM: { es: "Omán", de: "Oman", fr: "Oman", "zh-Hans": "阿曼", ko: "오만" },
  PA: { es: "Panamá", de: "Panama", fr: "Panama", "zh-Hans": "巴拿马", ko: "파나마" },
  PE: { es: "Perú", de: "Peru", fr: "Pérou", "zh-Hans": "秘鲁", ko: "페루" },
  PF: { es: "Polinesia Francesa", de: "Französisch-Polynesien", fr: "Polynésie française", "zh-Hans": "法属波利尼西亚", ko: "프랑스령 폴리네시아" },
  PG: { es: "Papúa Nueva Guinea", de: "Papua-Neuguinea", fr: "Papouasie-Nouvelle-Guinée", "zh-Hans": "巴布亚新几内亚", ko: "파푸아뉴기니" },
  PH: { es: "Filipinas", de: "Philippinen", fr: "Philippines", "zh-Hans": "菲律宾", ko: "필리핀" },
  PK: { es: "Pakistán", de: "Pakistan", fr: "Pakistan", "zh-Hans": "巴基斯坦", ko: "파키스탄" },
  PL: { es: "Polonia", de: "Polen", fr: "Pologne", "zh-Hans": "波兰", ko: "폴란드" },
  PM: { es: "San Pedro y Miquelón", de: "St. Pierre und Miquelon", fr: "Saint-Pierre-et-Miquelon", "zh-Hans": "圣皮埃尔和密克隆群岛", ko: "생피에르 미클롱" },
  PR: { es: "Puerto Rico", de: "Puerto Rico", fr: "Porto Rico", "zh-Hans": "波多黎各", ko: "푸에르토리코" },
  PS: { es: "Territorios Palestinos", de: "Palästinensische Autonomiegebiete", fr: "Territoires palestiniens", "zh-Hans": "巴勒斯坦领土", ko: "팔레스타인 지구" },
  PT: { es: "Portugal", de: "Portugal", fr: "Portugal", "zh-Hans": "葡萄牙", ko: "포르투갈" },
  PW: { es: "Palaos", de: "Palau", fr: "Palaos", "zh-Hans": "帕劳", ko: "팔라우" },
  PY: { es: "Paraguay", de: "Paraguay", fr: "Paraguay", "zh-Hans": "巴拉圭", ko: "파라과이" },
  QA: { es: "Catar", de: "Katar", fr: "Qatar", "zh-Hans": "卡塔尔", ko: "카타르" },
  RE: { es: "Reunión", de: "Réunion", fr: "La Réunion", "zh-Hans": "留尼汪", ko: "레위니옹" },
  RO: { es: "Rumanía", de: "Rumänien", fr: "Roumanie", "zh-Hans": "罗马尼亚", ko: "루마니아" },
  RS: { es: "Serbia", de: "Serbien", fr: "Serbie", "zh-Hans": "塞尔维亚", ko: "세르비아" },
  RU: { es: "Rusia", de: "Russland", fr: "Russie", "zh-Hans": "俄罗斯", ko: "러시아" },
  RW: { es: "Ruanda", de: "Ruanda", fr: "Rwanda", "zh-Hans": "卢旺达", ko: "르완다" },
  SA: { es: "Arabia Saudí", de: "Saudi-Arabien", fr: "Arabie saoudite", "zh-Hans": "沙特阿拉伯", ko: "사우디아라비아" },
  SB: { es: "Islas Salomón", de: "Salomonen", fr: "Îles Salomon", "zh-Hans": "所罗门群岛", ko: "솔로몬 제도" },
  SC: { es: "Seychelles", de: "Seychellen", fr: "Seychelles", "zh-Hans": "塞舌尔", ko: "세이셸" },
  SD: { es: "Sudán", de: "Sudan", fr: "Soudan", "zh-Hans": "苏丹", ko: "수단" },
  SE: { es: "Suecia", de: "Schweden", fr: "Suède", "zh-Hans": "瑞典", ko: "스웨덴" },
  SG: { es: "Singapur", de: "Singapur", fr: "Singapour", "zh-Hans": "新加坡", ko: "싱가포르" },
  SI: { es: "Eslovenia", de: "Slowenien", fr: "Slovénie", "zh-Hans": "斯洛文尼亚", ko: "슬로베니아" },
  SK: { es: "Eslovaquia", de: "Slowakei", fr: "Slovaquie", "zh-Hans": "斯洛伐克", ko: "슬로바키아" },
  SL: { es: "Sierra Leona", de: "Sierra Leone", fr: "Sierra Leone", "zh-Hans": "塞拉利昂", ko: "시에라리온" },
  SM: { es: "San Marino", de: "San Marino", fr: "Saint-Marin", "zh-Hans": "圣马力诺", ko: "산마리노" },
  SN: { es: "Senegal", de: "Senegal", fr: "Sénégal", "zh-Hans": "塞内加尔", ko: "세네갈" },
  SO: { es: "Somalia", de: "Somalia", fr: "Somalie", "zh-Hans": "索马里", ko: "소말리아" },
  SR: { es: "Surinam", de: "Suriname", fr: "Suriname", "zh-Hans": "苏里南", ko: "수리남" },
  SS: { es: "Sudán del Sur", de: "Südsudan", fr: "Soudan du Sud", "zh-Hans": "南苏丹", ko: "남수단" },
  ST: { es: "Santo Tomé y Príncipe", de: "São Tomé und Príncipe", fr: "Sao Tomé-et-Principe", "zh-Hans": "圣多美和普林西比", ko: "상투메 프린시페" },
  SV: { es: "El Salvador", de: "El Salvador", fr: "Salvador", "zh-Hans": "萨尔瓦多", ko: "엘살바도르" },
  SX: { es: "Sint Maarten", de: "Sint Maarten", fr: "Sint Maarten", "zh-Hans": "荷属圣马丁", ko: "신트마르턴" },
  SY: { es: "Siria", de: "Syrien", fr: "Syrie", "zh-Hans": "叙利亚", ko: "시리아" },
  SZ: { es: "Esuatini", de: "Eswatini", fr: "Eswatini", "zh-Hans": "埃斯瓦蒂尼", ko: "에스와티니" },
  TC: { es: "Islas Turcas y Caicos", de: "Turks- und Caicosinseln", fr: "Îles Turques-et-Caïques", "zh-Hans": "特克斯和凯科斯群岛", ko: "터크스 케이커스 제도" },
  TD: { es: "Chad", de: "Tschad", fr: "Tchad", "zh-Hans": "乍得", ko: "차드" },
  TG: { es: "Togo", de: "Togo", fr: "Togo", "zh-Hans": "多哥", ko: "토고" },
  TH: { es: "Tailandia", de: "Thailand", fr: "Thaïlande", "zh-Hans": "泰国", ko: "태국" },
  TJ: { es: "Tayikistán", de: "Tadschikistan", fr: "Tadjikistan", "zh-Hans": "塔吉克斯坦", ko: "타지키스탄" },
  TL: { es: "Timor-Leste", de: "Timor-Leste", fr: "Timor oriental", "zh-Hans": "东帝汶", ko: "동티모르" },
  TM: { es: "Turkmenistán", de: "Turkmenistan", fr: "Turkménistan", "zh-Hans": "土库曼斯坦", ko: "투르크메니스탄" },
  TN: { es: "Túnez", de: "Tunesien", fr: "Tunisie", "zh-Hans": "突尼斯", ko: "튀니지" },
  TO: { es: "Tonga", de: "Tonga", fr: "Tonga", "zh-Hans": "汤加", ko: "통가" },
  TR: { es: "Turquía", de: "Türkei", fr: "Turquie", "zh-Hans": "土耳其", ko: "튀르키예" },
  TT: { es: "Trinidad y Tobago", de: "Trinidad und Tobago", fr: "Trinité-et-Tobago", "zh-Hans": "特立尼达和多巴哥", ko: "트리니다드 토바고" },
  TV: { es: "Tuvalu", de: "Tuvalu", fr: "Tuvalu", "zh-Hans": "图瓦卢", ko: "투발루" },
  TW: { es: "Taiwán", de: "Taiwan", fr: "Taïwan", "zh-Hans": "台湾", ko: "대만" },
  TZ: { es: "Tanzania", de: "Tansania", fr: "Tanzanie", "zh-Hans": "坦桑尼亚", ko: "탄자니아" },
  UA: { es: "Ucrania", de: "Ukraine", fr: "Ukraine", "zh-Hans": "乌克兰", ko: "우크라이나" },
  UG: { es: "Uganda", de: "Uganda", fr: "Ouganda", "zh-Hans": "乌干达", ko: "우간다" },
  US: { es: "Estados Unidos", de: "Vereinigte Staaten", fr: "États-Unis", "zh-Hans": "美国", ko: "미국" },
  UY: { es: "Uruguay", de: "Uruguay", fr: "Uruguay", "zh-Hans": "乌拉圭", ko: "우루과이" },
  VA: { es: "Ciudad del Vaticano", de: "Vatikanstadt", fr: "État de la Cité du Vatican", "zh-Hans": "梵蒂冈", ko: "바티칸 시국" },
  UZ: { es: "Uzbekistán", de: "Usbekistan", fr: "Ouzbékistan", "zh-Hans": "乌兹别克斯坦", ko: "우즈베키스탄" },
  VC: { es: "San Vicente y las Granadinas", de: "St. Vincent und die Grenadinen", fr: "Saint-Vincent-et-les-Grenadines", "zh-Hans": "圣文森特和格林纳丁斯", ko: "세인트빈센트그레나딘" },
  VE: { es: "Venezuela", de: "Venezuela", fr: "Venezuela", "zh-Hans": "委内瑞拉", ko: "베네수엘라" },
  VG: { es: "Islas Vírgenes Británicas", de: "Britische Jungferninseln", fr: "Îles Vierges britanniques", "zh-Hans": "英属维尔京群岛", ko: "영국령 버진아일랜드" },
  VI: { es: "Islas Vírgenes de EE. UU.", de: "Amerikanische Jungferninseln", fr: "Îles Vierges des États-Unis", "zh-Hans": "美属维尔京群岛", ko: "미국령 버진아일랜드" },
  VN: { es: "Vietnam", de: "Vietnam", fr: "Viêt Nam", "zh-Hans": "越南", ko: "베트남" },
  VU: { es: "Vanuatu", de: "Vanuatu", fr: "Vanuatu", "zh-Hans": "瓦努阿图", ko: "바누아투" },
  WS: { es: "Samoa", de: "Samoa", fr: "Samoa", "zh-Hans": "萨摩亚", ko: "사모아" },
  XK: { es: "Kosovo", de: "Kosovo", fr: "Kosovo", "zh-Hans": "科索沃", ko: "코소보" },
  YE: { es: "Yemen", de: "Jemen", fr: "Yémen", "zh-Hans": "也门", ko: "예멘" },
  YT: { es: "Mayotte", de: "Mayotte", fr: "Mayotte", "zh-Hans": "马约特", ko: "마요트" },
  ZA: { es: "Sudáfrica", de: "Südafrika", fr: "Afrique du Sud", "zh-Hans": "南非", ko: "남아프리카 공화국" },
  ZM: { es: "Zambia", de: "Sambia", fr: "Zambie", "zh-Hans": "赞比亚", ko: "잠비아" },
  ZW: { es: "Zimbabue", de: "Simbabwe", fr: "Zimbabwe", "zh-Hans": "津巴布韦", ko: "짐바브웨" },
});

for (const v of Object.values(COUNTRY_NAMES_I18N)) Object.freeze(v);

/**
 * A country's name in any of the seven languages: ru/en from country-names.mjs,
 * the rest from this table. Throws on an unknown code or language rather than
 * returning the code — a page that printed «AE» would look deliberate.
 */
export function countryName(iso, lang) {
  const code = String(iso || '');
  if (!Object.prototype.hasOwnProperty.call(COUNTRY_NAMES, code)) throw new Error(`countryName: unknown code ${code}`);
  if (lang === 'ru' || lang === 'en') return COUNTRY_NAMES[code][lang];
  if (!I18N_COUNTRY_LANGS.includes(lang)) throw new Error(`countryName: unknown language ${lang}`);
  return COUNTRY_NAMES_I18N[code][lang];
}
