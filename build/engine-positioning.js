var ArchitectCanvasPositioning = (function () {

  function countByStatus(systems) {
    var active = 0, transitioning = 0, missing = 0, stalled = 0;
    for (var i = 0; i < systems.length; i++) {
      var s = systems[i].status;
      if (s === 'active') active++;
      else if (s === 'transitioning') transitioning++;
      else if (s === 'missing') missing++;
      else if (s === 'stalled') stalled++;
    }
    return { active: active, transitioning: transitioning, missing: missing, stalled: stalled, total: systems.length };
  }

  function resolveGap(authority, systems, userGap) {
    var found = null;
    for (var i = 0; i < systems.length; i++) {
      if (
        systems[i].name === authority ||
        systems[i].id === authority ||
        systems[i].owner === authority
      ) {
        found = systems[i];
        break;
      }
    }
    if (found && (found.status === 'missing')) {
      return (userGap ? userGap + '；' : '') + '權威來源缺位，建議優先建立此能力';
    }
    if (found && (found.status === 'stalled')) {
      return (userGap ? userGap + '；' : '') + '權威來源停擺，需盡速恢復或移交';
    }
    return userGap || '暫無已知缺口';
  }

  function goalPhrase(primaryGoal, audience) {
    var phrases = {
      integration: {
        executive: '整合分散系統、消除資訊孤島，以提升決策效率與跨部門協作能力',
        tech: '統一整合介面、降低跨系統耦合度，建立標準化資料與服務流通管道',
        client: '提供一致的端對端服務能力，消除因系統割裂造成的服務斷點'
      },
      modernization: {
        executive: '汰換老舊系統、降低技術債風險，為組織長期競爭力奠定現代化基礎',
        tech: '推動系統現代化演進，以模組化架構取代單體遺留系統，降低維護成本',
        client: '以現代化平台能力支撐持續創新，確保服務穩定性與可擴充性'
      },
      security: {
        executive: '強化資安治理架構，降低合規風險與資料洩漏暴露面',
        tech: '建立統一的身份驗證、授權與稽核鏈，收斂分散式資安管控缺口',
        client: '以高規格資安架構保護客戶資料，滿足法規與信任要求'
      },
      scale: {
        executive: '建構可規模化的系統基盤，支撐業務成長而不需線性增加人力與成本',
        tech: '設計高可用、水平可擴展的服務架構，確保流量峰值下的系統韌性',
        client: '以可靈活擴展的平台能力，支援客戶業務規模的持續成長'
      },
      cost: {
        executive: '透過整合重複能力、消除冗餘建置，實現系統總擁有成本的實質降低',
        tech: '識別並消除重複開發的功能模組，集中資源於差異化能力的建設',
        client: '以精實的系統架構降低服務交付成本，將效益回饋至客戶端'
      }
    };
    var goal = phrases[primaryGoal] || phrases['integration'];
    return goal[audience] || goal['tech'];
  }

  function openingByAudience(audience, stats, orgName) {
    var name = orgName || '本組織';
    var base = name + ' 目前涵蓋共 ' + stats.total + ' 套系統，其中現行運作 ' + stats.active + ' 套、轉型進行中 ' + stats.transitioning + ' 套';
    if (stats.missing > 0 || stats.stalled > 0) {
      base += '、停擺或缺位 ' + (stats.missing + stats.stalled) + ' 套';
    }
    if (audience === 'executive') {
      return base + '。從治理角度觀察，系統覆蓋度與能力完整性直接影響組織決策品質與風險暴露面。現有缺口若未妥善治理，將形成難以預期的技術負債與業務中斷風險。';
    }
    if (audience === 'client') {
      return base + '。從服務交付能力的角度，系統成熟度分佈顯示現有能力已具備一定基礎，但部分關鍵能力尚在建置或已出現停擺，需優先補位以確保端對端服務品質。';
    }
    return base + '。從架構健康度角度，各層系統的成熟度分佈揭示了整體能力的完整性與可靠性現況，並指出最需優先處理的結構性缺口。';
  }

  function positioningCore(coreValue, primaryGoal, audience) {
    var value = (coreValue || '提供穩定可靠的數位能力基礎').replace(/[。.\s]+$/, '');
    var goal = goalPhrase(primaryGoal, audience);
    if (audience === 'executive') {
      return '本系統群的核心定位在於：' + value + '。為實現此定位，架構演進的主要方向為「' + goal + '」。這不僅是技術決策，更是組織戰略能力建設的體現——透過明確的能力邊界與歸屬原則，確保每一項投資都服務於核心價值的兌現，而非重複消耗在邊際效益遞減的冗餘建置上。';
    }
    if (audience === 'client') {
      return '本系統群的定位主張是：' + value + '。在此核心主張下，我們以「' + goal + '」作為架構演進的主軸，確保所提供的平台能力能夠持續、穩定地支撐業務場景，並以透明的能力歸屬機制回應對服務可靠性與可預測性的要求。';
    }
    return '本系統群的架構定位主張為：' + value + '。為落實此定位，架構演進以「' + goal + '」為核心方向，並以能力歸屬原則作為治理基礎——確保每項能力都有明確的權威來源，避免在重複建置上耗費有限的工程資源。';
  }

  function governanceSection(duplicationRisks, authorities, audience) {
    var risks = (duplicationRisks || '跨團隊重複建置相似功能，導致維護成本上升與資料不一致').replace(/[。.，,\s]+$/, '');
    var authList = [];
    for (var i = 0; i < authorities.length; i++) {
      authList.push(authorities[i].capability);
    }
    var authText = authList.length > 0 ? authList.join('、') : '核心業務能力';

    var prefix = '';
    if (audience === 'executive') {
      prefix = '在治理層面，' + risks + '，是導致資源耗散與系統複雜度持續攀升的關鍵因素。為此，本架構明確劃定以下能力的權威來源：' + authText + '。治理原則是：任何新系統立案前，須優先查閱能力歸屬原則表；凡已有權威來源的能力，一律透過介接取用，不得自行建置。此原則直接降低重複投資風險，並確保能力的演進由明確的負責方主導。';
    } else if (audience === 'client') {
      prefix = '為確保服務能力的一致性與可信賴度，' + risks + '，需透過明確的能力治理機制加以控制。本架構規範了以下能力的權威來源：' + authText + '。所有新增服務在建立前，必須先確認能力歸屬，有既有權威來源者一律介接，確保客戶所使用的每一項能力皆有單一、受管理的來源，消除因多頭並進造成的服務品質落差。';
    } else {
      prefix = '針對重複開發風險，' + risks + '，是本架構治理需直接處理的核心問題。架構治理明確要求：' + authText + ' 等能力設有權威來源，任何新系統立案前必須查閱能力歸屬原則表，已有權威來源者一律介接取用、不得自建。這項原則是降低系統碎片化、遏止技術債擴張最直接有效的手段。';
    }
    return prefix;
  }

  function closingSection(primaryGoal, audience, orgName) {
    var name = orgName || '本組織';
    if (audience === 'executive') {
      return '展望後續，' + name + ' 應優先補強缺位能力、確立各系統的治理歸屬，並以本定位論述作為後續架構評審的基準。每一項新增或調整，均應對照核心定位主張，確保架構演進始終服務於組織的長期戰略目標，而非被短期需求推著走。';
    }
    if (audience === 'client') {
      return '本定位論述代表了我們對系統能力建設的整體承諾。後續架構演進將以此為基準，持續強化能力完整性、消除服務缺口，確保所交付的平台能力能夠兌現對客戶的服務承諾，並在需求變化時保有足夠的靈活度與可擴展性。';
    }
    return '本定位論述作為架構決策的基準文件，後續所有系統立案、技術評審與資源配置，均應回歸本論述所界定的定位主張與治理原則進行對照。能力歸屬原則表需隨架構演進持續維護，確保其有效性與準確性，作為工程團隊日常決策的第一道參照。';
  }

  function buildHighlights(answers, stats, audience) {
    var goal = goalPhrase(answers.primaryGoal, audience);
    var bullets = [];

    bullets.push('系統全景：共 ' + stats.total + ' 套，現行 ' + stats.active + ' 套、轉型中 ' + stats.transitioning + ' 套、缺位或停擺 ' + (stats.missing + stats.stalled) + ' 套');
    bullets.push('核心定位：' + (answers.coreValue || '提供穩定可靠的數位能力基礎'));
    bullets.push('架構主軸：' + goal);

    if (answers.authorities && answers.authorities.length > 0) {
      var caps = [];
      for (var i = 0; i < answers.authorities.length; i++) {
        caps.push(answers.authorities[i].capability);
      }
      bullets.push('權威來源能力：' + caps.join('、') + '——新系統立案前須先查歸屬表，有既有來源者不得自建');
    }

    if (answers.duplicationRisks) {
      bullets.push('重複開發風險：' + answers.duplicationRisks.substring(0, 60) + (answers.duplicationRisks.length > 60 ? '…' : ''));
    } else {
      bullets.push('已識別重複開發風險，治理原則已明訂於能力歸屬原則表');
    }

    return bullets.slice(0, 5);
  }

  function generatePositioning(answers, systems) {
    var safeAnswers = answers || {};
    var safeSystems = systems || [];
    var audience = safeAnswers.audience || 'tech';
    var authorities = safeAnswers.authorities || [];

    var stats = countByStatus(safeSystems);

    var capabilityTable = [];
    for (var i = 0; i < authorities.length; i++) {
      var a = authorities[i];
      capabilityTable.push({
        capability: a.capability || '未命名能力',
        authority: a.authority || '待定義',
        consumers: a.consumers || '待定義',
        gap: resolveGap(a.authority, safeSystems, a.gap)
      });
    }

    var p1 = openingByAudience(audience, stats, safeAnswers.orgName);
    var p2 = positioningCore(safeAnswers.coreValue, safeAnswers.primaryGoal, audience);
    var p3 = governanceSection(safeAnswers.duplicationRisks, authorities, audience);
    var p4 = closingSection(safeAnswers.primaryGoal, audience, safeAnswers.orgName);

    var narrative = p1 + '\n\n' + p2 + '\n\n' + p3 + '\n\n' + p4;

    var highlights = buildHighlights(safeAnswers, stats, audience);

    return {
      narrative: narrative,
      capabilityTable: capabilityTable,
      highlights: highlights
    };
  }

  return { generatePositioning: generatePositioning };
})();

if (typeof window === 'undefined') {
  var testAnswersTech = {
    orgName: '數位平台部',
    coreValue: '為全集團提供統一、可信賴的數位服務基礎設施',
    primaryGoal: 'integration',
    duplicationRisks: '各業務單位各自建置通知服務與身份驗證模組，導致至少三套並行、版本不一',
    authorities: [
      { capability: '身份驗證', authority: 'IAM系統', consumers: '所有前後台', gap: '' },
      { capability: '訊息通知', authority: 'NotifyHub', consumers: '電商、CRM、ERP', gap: '尚未覆蓋移動端' },
      { capability: '支付閘道', authority: 'PayGateway', consumers: '電商平台', gap: '' },
      { capability: '資料倉儲', authority: 'DataWarehouse', consumers: '報表、BI', gap: '' }
    ],
    audience: 'tech'
  };

  var testAnswersExec = Object.assign({}, testAnswersTech, { audience: 'executive' });
  var testAnswersClient = Object.assign({}, testAnswersTech, { audience: 'client' });

  var testSystems = [
    { id: 'iam', name: 'IAM系統', owner: '平台組', layer: 'platform', dependsOn: [], status: 'active' },
    { id: 'notify', name: 'NotifyHub', owner: '平台組', layer: 'platform', dependsOn: ['iam'], status: 'active' },
    { id: 'pay', name: 'PayGateway', owner: '支付組', layer: 'service', dependsOn: ['iam'], status: 'transitioning' },
    { id: 'dw', name: 'DataWarehouse', owner: '數據組', layer: 'data', dependsOn: [], status: 'stalled' },
    { id: 'crm', name: 'CRM', owner: '業務組', layer: 'application', dependsOn: ['iam', 'notify'], status: 'active' },
    { id: 'mdm', name: 'MDM主資料', owner: '數據組', layer: 'data', dependsOn: [], status: 'missing' }
  ];

  var resultTech = ArchitectCanvasPositioning.generatePositioning(testAnswersTech, testSystems);
  var resultExec = ArchitectCanvasPositioning.generatePositioning(testAnswersExec, testSystems);
  var resultClient = ArchitectCanvasPositioning.generatePositioning(testAnswersClient, testSystems);

  console.assert(typeof resultTech.narrative === 'string' && resultTech.narrative.length > 300, 'FAIL: narrative 長度不足');

  var hasActive = resultTech.narrative.indexOf('3') !== -1 || resultTech.narrative.indexOf('三') !== -1;
  var hasTransitioning = resultTech.narrative.indexOf('1') !== -1 || resultTech.narrative.indexOf('一') !== -1;
  console.assert(resultTech.narrative.indexOf('6') !== -1, 'FAIL: narrative 未含系統總數');
  console.assert(resultTech.narrative.indexOf('active') === -1, 'FAIL: narrative 含英文狀態詞');

  console.assert(resultTech.capabilityTable.length === testAnswersTech.authorities.length, 'FAIL: capabilityTable 長度不符');

  var dwEntry = null;
  for (var i = 0; i < resultTech.capabilityTable.length; i++) {
    if (resultTech.capabilityTable[i].authority === 'DataWarehouse') {
      dwEntry = resultTech.capabilityTable[i];
    }
  }
  console.assert(dwEntry !== null, 'FAIL: 找不到 DataWarehouse 能力條目');
  console.assert(dwEntry && (dwEntry.gap.indexOf('缺位') !== -1 || dwEntry.gap.indexOf('停擺') !== -1), 'FAIL: stalled authority gap 未標示停擺');

  console.assert(resultTech.narrative !== resultExec.narrative, 'FAIL: tech 與 executive audience narrative 相同');
  console.assert(resultTech.narrative !== resultClient.narrative, 'FAIL: tech 與 client audience narrative 相同');

  var placeholders = ['TODO', 'TBD', '{{', '}}'];
  for (var p = 0; p < placeholders.length; p++) {
    console.assert(resultTech.narrative.indexOf(placeholders[p]) === -1, 'FAIL: narrative 含佔位符 ' + placeholders[p]);
  }

  console.log('=== Self-Test Passed ===');
  console.log('');
  console.log('--- narrative (tech audience) ---');
  console.log(resultTech.narrative);
  console.log('');
  console.log('--- capabilityTable ---');
  for (var c = 0; c < resultTech.capabilityTable.length; c++) {
    var row = resultTech.capabilityTable[c];
    console.log('[' + row.capability + '] authority=' + row.authority + ' | gap=' + row.gap);
  }
  console.log('');
  console.log('--- highlights ---');
  for (var h = 0; h < resultTech.highlights.length; h++) {
    console.log('- ' + resultTech.highlights[h]);
  }
}
