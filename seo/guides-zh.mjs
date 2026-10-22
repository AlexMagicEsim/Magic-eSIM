// The Simplified Chinese guides: /zh/guides/<slug>/ (I18N ZH-1, 2026-10-22). Data only; seo/build-locale-pages.mjs
// renders them. Simplified Chinese, the reader addressed with «您» (owner D1); PRC punctuation norms — full-width
// ，。：；？！ and “” quotes —, a space between Chinese and Latin letters or digits (D6). Every section carries an ASCII
// `id` (a Chinese heading makes no usable anchor).
//
// FACT POLICY — the English guides' policy (seo/guides-en.mjs), unchanged: menu paths are typical and said to vary;
// nothing about what Magic eSIM will deliver or how; no pointer to a card row the plan cards do not show; the
// start-of-term advice is the one safe for every plan (install on the day you travel, over Wi-Fi); no network-quality
// promise, no hotspot / APN / calls / SMS / 2FA guarantee, no device-model list, no payment method; a QR code «may be
// single-use»; nothing about which services can be reached in mainland China. seo/claim-guards.mjs (zh-Hans) enforces
// these on the rendered pages. AI-assisted draft; its quality gate is the three-stage AI review (localization-qa skill).
//
// THE ONE ADDITION (owner D12, Chinese only): the compatibility guide states what Apple publishes about iPhone and eSIM
// in mainland China — the models bought there that support eSIM, and that an eSIM of a carrier outside mainland China
// cannot be installed while the iPhone is in mainland China — attributed to Apple, with the page's date. The model list
// is the one device list on the site; it is allowed sentence by sentence (seo/claim-guards.mjs SOURCED), never by
// loosening the rule.
//
// SOURCES — every Chinese menu label below was read on the vendor's own Simplified Chinese page on 2026-10-22; a label
// not found there is NOT quoted (the action is described in plain words instead):
//   Apple zh-cn support.apple.com/zh-cn/118669 (设置 → “蜂窝网络”或“移动数据” → “添加 eSIM” / “添加蜂窝号码” → “手动输入详细信息”;
//               “相机”App → “检测到蜂窝号码” → “继续” → “添加蜂窝号码”, 确认码; iOS 17.4+: 轻点并按住二维码 → “添加 eSIM”),
//               /zh-cn/118227 (设置 → 通用 → 关于本机: “运营商锁”旁边显示“无 SIM 卡限制”), /zh-cn/109317 (“数据漫游” named, no path;
//               设置 → “蜂窝网络”或“移动数据” → “蜂窝数据” chooses the number for data), /zh-cn/HT201415 (status “无服务”),
//               /zh-cn/123879 «在中国大陆将 eSIM 与 iPhone 搭配使用», published 2026-09-09 (the D12 facts).
//   Google zh-Hans support.google.com/pixelphone/answer/16115470?hl=zh-Hans (网络和互联网 → SIM 卡 → 添加 SIM 卡 → 设置 eSIM 卡),
//               9449293 (网络和互联网 → SIM 卡 → 移动数据; 网络和互联网 → 移动网络 → the SIM → 使用此 SIM 卡), 2926415 (网络和互联网 →
//               SIM 卡: “漫游”, “接入点名称 (APN)”), 10402530 (关于手机 → SIM 卡状态 → EID; «如要使用 eSIM 卡，手机还需要 EID…号码»).
//   Samsung     no Samsung page in Simplified Chinese naming the eSIM menus was found (owner D13): the Samsung steps are
//               described, never quoted.

const P = '/zh';

export const ZH_GUIDES = [
  {
    slug: 'iphone',
    nav: 'iPhone',
    title: '在 iPhone 上安装 eSIM：分步说明 | Magic eSIM',
    description: '使用二维码或手动输入信息，在 iPhone 上安装旅行 eSIM，然后为旅行开启蜂窝数据。',
    h1: '在 iPhone 上安装 eSIM',
    blurb: '扫描二维码或手动输入，以及抵达后需要开启的设置。',
    lead: '安装只需几分钟，需要连接互联网，最简单的是使用无线局域网。完整流程如下：确认您的 iPhone 支持 eSIM，安装描述文件，抵达目的地后开启蜂窝数据。',
    sections: [
      { h2: '确认您的 iPhone 支持 eSIM', id: 'check', html: `
        <p>打开<strong>设置 → 蜂窝网络</strong>（或<strong>移动数据</strong>）。如果看到<strong>添加 eSIM</strong> 或<strong>添加蜂窝号码</strong>，说明您的 iPhone 支持 eSIM。</p>
        <p>此外，您的 iPhone 必须未被运营商锁定。请查看<a href="${P}/guides/compatibility/">如何检查兼容性</a>。在中国大陆购买的 iPhone，只有部分机型支持 eSIM，兼容性指南中有说明。</p>` },
      { h2: '方法一：扫描二维码', id: 'qr', html: `
        <ol class="steps">
          <li>在另一块屏幕上显示 eSIM 的二维码，例如电脑、平板电脑或另一部手机。</li>
          <li>在 iPhone 上打开<strong>相机</strong> App，扫描二维码。</li>
          <li>看到<strong>检测到蜂窝号码</strong>通知后，轻点它。</li>
          <li>轻点<strong>继续</strong>，然后轻点<strong>添加蜂窝号码</strong>。如果系统要求输入确认码，请输入随 eSIM 提供的确认码。</li>
          <li>为这个号码起一个清楚的名称，例如“旅行”，以免与您的主 SIM 卡混淆。</li>
        </ol>
        <p class="note">使用 iOS 17.4 或更高版本时，如果二维码就在这部 iPhone 的电子邮件或网页中，请轻点并按住二维码，然后轻点<strong>添加 eSIM</strong>。</p>` },
      { h2: '方法二：手动输入信息', id: 'manual', html: `
        <ol class="steps">
          <li>准备好随 eSIM 提供的手动安装信息。</li>
          <li>打开<strong>设置 → 蜂窝网络</strong>（或<strong>移动数据</strong>），轻点<strong>添加蜂窝号码</strong>。</li>
          <li>轻点屏幕底部的<strong>手动输入详细信息</strong>，然后输入这些信息。</li>
          <li>确认并等待安装完成。</li>
        </ol>
        <p class="note">没有可扫描的二维码时，这个方法很方便。</p>` },
      { h2: '抵达后：开启数据', id: 'data', html: `
        <ol class="steps">
          <li>在<strong>设置 → 蜂窝网络</strong>中，确认 eSIM 号码已开启。</li>
          <li>轻点<strong>蜂窝数据</strong>，选择 eSIM 号码。您的主 SIM 卡可以继续用于通话和短信。</li>
          <li>打开 eSIM 号码，开启<strong>数据漫游</strong>。旅行 eSIM 通常通过合作网络连接，手机会把这视为漫游。</li>
          <li>如果不想被原运营商收费，请关闭主 SIM 卡的数据漫游。</li>
          <li>等待一两分钟，让手机注册到当地网络。</li>
        </ol>
        <p class="note">菜单名称可能因 iOS 版本略有不同。</p>` },
      { h2: '如果无法正常使用', id: 'help', html: `
        <p>确认 eSIM 是用于数据的号码，并且已开启它的数据漫游，然后重启手机。完整清单请见“<a href="${P}/guides/troubleshooting/">eSIM 无法使用</a>”。</p>
        <p>排查问题时<strong>请不要删除 eSIM</strong>：它的二维码可能只能使用一次，删除后可能无法重新安装。</p>` },
    ],
    faq: [
      { q: '在 iPhone 上安装 eSIM 需要无线局域网吗？', a: '下载描述文件需要连接互联网，最简单的是使用无线局域网。在出行当天安装 eSIM（出发前在家中，或使用机场的无线局域网），无论套餐的有效期何时开始计算，这种做法都适用。' },
      { q: '二维码就在这部 iPhone 上，还能安装 eSIM 吗？', a: '可以。使用 iOS 17.4 或更高版本时，在电子邮件或网页中轻点并按住二维码，然后轻点“添加 eSIM”。您也可以选择“手动输入详细信息”，输入随 eSIM 提供的信息。' },
      { q: '我的主号码会怎样？', a: '主号码保持开启。主号码的来电和短信按原运营商的漫游条款处理；旅行 eSIM 用于蜂窝数据。' },
      { q: '为什么要为 eSIM 开启数据漫游？', a: '旅行 eSIM 通常通过合作网络连接，手机会把这视为漫游。为 eSIM 号码开启数据漫游是正常设置；主 SIM 卡的数据漫游可以保持关闭。' },
    ],
    related: ['android', 'compatibility', 'activation', 'troubleshooting'],
  },
  {
    slug: 'android',
    nav: 'Android',
    title: '在 Android 手机上安装 eSIM | Magic eSIM',
    description: '使用二维码或手动输入，在 Android 手机上安装旅行 eSIM，将其设为移动数据卡，并在抵达后开启漫游。',
    h1: '在 Android 手机上安装 eSIM',
    blurb: '不同品牌的 eSIM 设置通常在哪里，以及抵达后的第一步。',
    lead: '各个 Android 品牌的设置名称不同，但步骤相同：找到管理 SIM 卡的位置，用二维码或手动输入添加 eSIM，抵达后将其设为移动数据卡。安装需要连接互联网，最简单的是使用无线局域网。',
    sections: [
      { h2: '找到管理 SIM 卡的位置', id: 'find', html: `
        <p>SIM 卡设置通常在以下位置之一；名称因品牌和 Android 版本而异：</p>
        <ul class="list">
          <li><strong>Google Pixel：</strong>设置 → 网络和互联网 → SIM 卡 → <strong>添加 SIM 卡</strong> → <strong>设置 eSIM 卡</strong>。</li>
          <li><strong>Samsung Galaxy：</strong>在设置中打开与“连接”相关的菜单，找到管理 SIM 卡的选项，从那里添加 eSIM；具体名称因机型和 One UI 版本而异。</li>
          <li><strong>其他品牌：</strong>在设置中查找与移动网络、SIM 卡或连接相关的菜单。</li>
        </ul>
        <p>如果哪里都找不到添加 eSIM 的选项，请检查<a href="${P}/guides/compatibility/">您的手机是否支持 eSIM</a>。</p>` },
      { h2: '安装 eSIM', id: 'install', html: `
        <ol class="steps">
          <li>在另一块屏幕上显示 eSIM 的二维码。</li>
          <li>按上文所述开始添加 eSIM。<strong>Samsung：</strong>选择扫描二维码的选项并扫描。<strong>Pixel：</strong>按照屏幕上的说明操作。</li>
          <li>没有可扫描的二维码？在 Samsung 手机上，选择输入激活码的选项，输入随 eSIM 提供的信息；具体名称因 One UI 版本而异。</li>
          <li>确认并等待安装完成。</li>
          <li>为 eSIM 重命名，例如“旅行”。</li>
        </ol>` },
      { h2: '抵达后：开启数据', id: 'data', html: `
        <ol class="steps">
          <li>确认 eSIM 已开启。Pixel：设置 → 网络和互联网 → 移动网络 → 该 eSIM → <strong>使用此 SIM 卡</strong>。</li>
          <li>将 eSIM 设为<strong>移动数据</strong>使用的 SIM 卡。Pixel：设置 → 网络和互联网 → SIM 卡 → <strong>移动数据</strong>。您的主 SIM 卡可以继续用于通话和短信。</li>
          <li>为 eSIM 开启<strong>漫游</strong>。Pixel：设置 → 网络和互联网 → SIM 卡 → <strong>漫游</strong>。Samsung：在“连接”下的移动网络设置中查找；确切名称取决于机型。旅行 eSIM 通常通过合作网络连接，手机会把这视为漫游。</li>
          <li>如果不想被原运营商收费，请关闭主 SIM 卡的数据漫游。</li>
          <li>等待一两分钟，让手机注册到当地网络。</li>
        </ol>` },
      { h2: '如果无法正常使用', id: 'help', html: `
        <p>检查用于数据的 SIM 卡和 eSIM 的漫游设置，开启再关闭飞行模式，然后重启手机。完整清单请见“<a href="${P}/guides/troubleshooting/">eSIM 无法使用</a>”。</p>
        <p>排查问题时<strong>请不要删除 eSIM</strong>：它的二维码可能只能使用一次。</p>` },
    ],
    faq: [
      { q: '我的 Android 手机没有添加 eSIM 的选项，怎么办？', a: '请查看所有与 SIM 卡相关的菜单：名称因品牌而异。如果没有任何菜单提供添加或下载 eSIM 的选项，这部手机（或这个地区版本）很可能不支持 eSIM。' },
      { q: '可以同时使用 eSIM 和实体 SIM 卡吗？', a: '在支持 eSIM 的双卡手机上可以：将 eSIM 设为移动数据卡，实体 SIM 卡继续用于通话和短信。' },
      { q: '需要设置 APN 吗？', a: '只有当您的套餐信息中注明了 APN 时才需要：请在 eSIM 的设置中确认它与注明的一致。' },
    ],
    related: ['iphone', 'compatibility', 'activation', 'troubleshooting'],
  },
  {
    slug: 'compatibility',
    nav: '兼容性',
    title: '我的手机支持 eSIM 吗？如何检查 | Magic eSIM',
    description: '选择套餐前先检查 eSIM 兼容性：iPhone 和 Android 上要找的设置、运营商锁、地区版本，以及在中国大陆购买的 iPhone。',
    h1: '您的手机支持 eSIM 吗？',
    blurb: '选择套餐前，花一分钟检查一下。',
    lead: '最简单的检查方法：打开 SIM 卡设置，查找添加 eSIM 的选项。如果有，手机就支持 eSIM。同时再检查两点：手机是否被运营商锁定，以及它是哪个地区的版本。',
    sections: [
      { h2: '检查一：设置', id: 'setting', html: `
        <p><strong>iPhone：</strong>设置 → 蜂窝网络（或移动数据）。如果出现<strong>添加 eSIM</strong> 或<strong>添加蜂窝号码</strong>，说明这部 iPhone 支持 eSIM。</p>
        <p><strong>Android：</strong>打开 SIM 卡设置，查找添加 eSIM 的方法：在 Pixel 上，依次进入网络和互联网 → SIM 卡 → <strong>添加 SIM 卡</strong> → <strong>设置 eSIM 卡</strong>；Samsung 上在与“连接”相关的菜单中查找管理 SIM 卡的选项。</p>
        <p>Pixel 上的另一个线索：要使用 eSIM，手机还需要有 <strong>EID</strong> 号码。您可以在“设置 → 关于手机 → SIM 卡状态”中找到它。不过，以添加 eSIM 的设置为准。</p>` },
      { h2: '检查二：是否被运营商锁定？', id: 'lock', html: `
        <p>随合约购买的手机可能被运营商锁定，在解锁前无法使用其他 SIM 卡和 eSIM。</p>
        <p>在 iPhone 上，打开<strong>设置 → 通用 → 关于本机</strong>，查看<strong>运营商锁</strong>旁边是否显示“无 SIM 卡限制”。在 Android 手机上，请向出售手机的运营商咨询。</p>` },
      { h2: '检查三：地区版本', id: 'region', html: `
        <p>同一款机型在一个国家支持 eSIM，在另一个国家可能不支持：是否支持取决于手机面向的销售地区，而不只是型号名称。因此，除下文 Apple 公布的中国大陆机型外，我们不发布“兼容机型”列表：以您自己手机上的设置为准。</p>` },
      { h2: '在中国大陆购买的 iPhone', id: 'mainland', html: `
        <p>根据 Apple 于 2026 年 9 月 9 日发布的说明，在中国大陆，以下 iPhone 机型支持 eSIM：iPhone 18 Pro、iPhone 18 Pro Max、iPhone Duo、iPhone 17e 和 iPhone Air。</p>
        <p>Apple 表示，在中国大陆境外旅行时，可以在购自中国大陆并支持 eSIM 的 iPhone 上激活当地运营商提供的 eSIM；而在中国大陆，无法安装境外运营商提供的 eSIM。因此，如果您要带 iPhone 前往中国大陆，请在入境前安装 eSIM。</p>
        <p class="note">来源：Apple 支持文章<a href="https://support.apple.com/zh-cn/123879" rel="noopener">《在中国大陆将 eSIM 与 iPhone 搭配使用》</a>。</p>
        <p>在中国大陆购买的 Android 手机是否支持 eSIM，取决于机型和地区版本：请按上文在设置中检查。</p>` },
      { h2: '手机符合条件：下一步？', id: 'next', html: `
        <p>在<a href="${P}/esim/">目的地列表</a>中选择目的地，并了解如何在 <a href="${P}/guides/iphone/">iPhone</a> 或 <a href="${P}/guides/android/">Android 手机</a>上安装 eSIM。</p>` },
    ],
    faq: [
      { q: '我的手机支持双卡，是否就支持 eSIM？', a: '不一定：有些手机有两个实体卡槽，但不支持 eSIM。请在 SIM 卡设置中查找添加 eSIM 的选项。' },
      { q: '找不到 EID，是否说明手机不支持 eSIM？', a: '不一定。以设置中添加 eSIM 的选项为准。' },
      { q: '如果我的手机不支持 eSIM 怎么办？', a: '旅行 eSIM 无法在这部手机上使用。您需要另一部支持 eSIM 的手机，或者在目的地使用当地的实体 SIM 卡。' },
    ],
    related: ['iphone', 'android', 'activation', 'troubleshooting'],
  },
  {
    slug: 'activation',
    nav: '何时安装',
    title: '何时安装和开启旅行 eSIM | Magic eSIM',
    description: '安装 eSIM 和开始计算有效期是两回事：何时安装、何时开启号码和漫游，以及出行当天的清单。',
    h1: '何时安装和开启您的 eSIM',
    blurb: '安装描述文件和开始使用套餐是两个不同的时刻。',
    lead: '安装 eSIM 和开始计算有效期不是一回事，而且不同套餐的有效期开始时间各不相同。适用于所有套餐的建议：在出行当天通过无线局域网安装 eSIM，抵达后再开启 eSIM 的数据。',
    sections: [
      { h2: '四个不同的步骤', id: 'steps', html: `
        <ol class="steps">
          <li><strong>安装</strong>：手机通过二维码下载 eSIM 描述文件。需要连接互联网。</li>
          <li><strong>开启号码</strong>：eSIM 在 SIM 卡列表中显示为已开启。</li>
          <li><strong>设为移动数据卡</strong>：上网流量通过 eSIM。</li>
          <li><strong>开启数据漫游</strong>：为 eSIM 开启后，它就能在境外使用合作网络。</li>
        </ol>` },
      { h2: '有效期何时开始？', id: 'validity', html: `
        <p>这取决于套餐。有些套餐在 eSIM 首次连接目的地网络或首次使用数据时开始计算，有些在安装 eSIM 时就开始计算。</p>
        <p>因此，永远不会让您损失天数的建议是：<strong>在出行当天安装 eSIM</strong>（出发前在家中或使用机场的无线局域网），落地后再开启数据。</p>` },
      { h2: '出行当天清单', id: 'checklist', html: `
        <ul class="list">
          <li>您的手机支持 eSIM，且未被运营商锁定（<a href="${P}/guides/compatibility/">检查</a>）。</li>
          <li>eSIM 的二维码或手动安装信息已准备好，并保存在离线也能打开的地方。</li>
          <li>通过无线局域网安装 eSIM（<a href="${P}/guides/iphone/">iPhone</a>、<a href="${P}/guides/android/">Android</a>）。</li>
          <li>落地前，主 SIM 卡继续负责数据。</li>
        </ul>` },
      { h2: '落地之后', id: 'landed', html: `
        <ol class="steps">
          <li>如果 eSIM 号码已关闭，请开启它。</li>
          <li>将 eSIM 设为移动数据卡。</li>
          <li>为 eSIM 开启数据漫游。</li>
          <li>等待一到三分钟。没有信号？开启再关闭飞行模式。</li>
          <li>仍然不行？请查看“<a href="${P}/guides/troubleshooting/">eSIM 无法使用</a>”。</li>
        </ol>` },
      { h2: '抵达时还没安装 eSIM，也没有无线局域网？', id: 'no-wifi', html: `
        <p>下载描述文件需要连接互联网。可以使用机场的免费无线局域网，或者同行旅伴手机共享的网络。手动输入信息同样需要互联网来下载描述文件。</p>` },
    ],
    faq: [
      { q: '我在出行前一周安装了 eSIM，套餐的有效期已经开始了吗？', a: '这取决于套餐：有些在安装时开始计算，有些在目的地首次连接网络或首次使用数据时开始。为了适用于所有套餐，请在出行当天安装 eSIM。' },
      { q: '在家开启数据漫游会产生费用吗？', a: '开关本身不收费，它只是允许号码使用合作网络。关键在于哪个号码用于移动数据，以及您的套餐条款。' },
      { q: '我已经抵达，但无法上网。要等多久？', a: '为 eSIM 开启数据和漫游后，注册网络通常需要一两分钟。开启再关闭飞行模式往往有帮助。如果 10 到 15 分钟后仍然没有网络，请按照故障排除清单操作。' },
    ],
    related: ['iphone', 'android', 'troubleshooting', 'compatibility'],
  },
  {
    slug: 'troubleshooting',
    nav: '故障排除',
    title: 'eSIM 在境外无法使用？检查什么 | Magic eSIM',
    description: '旅行 eSIM 没有信号或无法上网时的分步检查清单：数据号码、漫游、飞行模式、手动选择网络，以及何时不要删除 eSIM。',
    h1: 'eSIM 无法使用：检查什么',
    blurb: '一份清单，按能解决大多数问题的顺序排列。',
    lead: '大多数问题都出在某项设置上。请按顺序检查，每完成一步就测试一次网络。排查问题时请不要删除 eSIM。',
    sections: [
      { h2: '检查清单', id: 'checklist', html: `
        <ol class="steps">
          <li><strong>eSIM 号码开启了吗？</strong>在 SIM 卡设置中检查。</li>
          <li><strong>eSIM 设为移动数据卡了吗？</strong>上网流量应通过 eSIM，而不是主 SIM 卡。</li>
          <li><strong>eSIM 的数据漫游开启了吗？</strong>旅行 eSIM 通常通过合作网络连接，手机会把这视为漫游。</li>
          <li><strong>开启飞行模式</strong>十秒钟，然后关闭。</li>
          <li><strong>重启手机。</strong></li>
          <li><strong>手动选择网络。</strong>在 eSIM 的网络设置中关闭自动选择，从列表中选择另一个网络。</li>
          <li><strong>检查 APN</strong>，仅当您的套餐信息中注明了 APN 时：它必须与 eSIM 设置中的一致。</li>
          <li><strong>您在套餐的覆盖范围内吗？</strong>确认您所在的国家或地区在套餐覆盖的国家和地区之列。</li>
        </ol>` },
      { h2: '有信号，但无法上网', id: 'no-internet', html: `
        <p>手机已注册网络，但数据不通。最常见的原因是 eSIM 不是用于移动数据的号码，或者它的数据漫游已关闭。请检查这两项，然后开启再关闭飞行模式。</p>` },
      { h2: '请不要删除 eSIM', id: 'dont-delete', html: `
        <p>删除 eSIM 几乎解决不了问题，而且它的二维码可能只能使用一次：删除后可能无法重新安装。按清单检查时，请保留 eSIM。</p>` },
      { h2: '仍然无法连接？', id: 'contact', html: `
        <p>如果您已按完整清单检查，eSIM 仍然无法使用，请发送电子邮件至 <a href="mailto:support@magicesim.store">support@magicesim.store</a>。</p>` },
    ],
    faq: [
      { q: 'eSIM 显示“无服务”，首先该怎么做？', a: '确认已为 eSIM 开启数据漫游，开启再关闭飞行模式，等待几分钟。然后尝试手动选择网络。' },
      { q: '可以用同一个二维码重新安装 eSIM 吗？', a: '通常不行：二维码可能只能使用一次。所以清单提醒您不要删除 eSIM。' },
      { q: '排查问题时，主 SIM 卡会产生费用吗？', a: '如果主 SIM 卡被设为移动数据卡，并且开启了数据漫游，原运营商可能会收费。请保持 eSIM 为数据号码，或关闭主 SIM 卡的数据漫游。' },
    ],
    related: ['iphone', 'android', 'activation', 'compatibility'],
  },
];
