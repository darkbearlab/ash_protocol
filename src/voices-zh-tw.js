// Chinese enemy voice lines (moved out of src/callout-ui.js in 3.167.0; docs/TEXT_INVENTORY.md). Each cue lists its
// variants; callout-ui picks one by hashing the event. The English table (src/voices-en.js) has the same variants, line
// for line (3.177.7). 3.177.7 (user): the loyalist advance no longer names a numbered squad (第一班 / First squad).
const HUMAN={
 // 3.130.0 draft: in place for an ambush. Vague by the user's rule — never says what it is doing.
 lurk:['安靜……','就這裡，等著。'],
 grenade:['手榴彈！','丟雷了！','投彈，找掩護！'],bombard:['標定座標！','轟炸就位！'],aim:['鎖定目標。','瞄準中……','別動……'],attack:['衝上去！','準備開火！','壓上去！'],
 affix_fast:['跟上速度！','動作快！'],affix_infrared:['熱源顯示……','紅外線啟動。'],affix_night_vision:['夜視開啟。','黑暗藏不住你。'],affix_suppressor:['火力壓制！','別讓他抬頭！'],affix_grenadier:['我帶了炸藥。','準備投擲。'],
 move:['推進！','往前壓。','移動！'],cover:['找掩護！','躲好！'],hold:['守住位置！','原地開火！'],reload:['換彈！','裝填中！'],flank:['繞過去！','從側面包抄！'],
 hit:['我中彈了！','被打中了！'],wounded:['傷得不輕……','還撐得住……'],critical:['需要支援！','撐不住了……'],suppressed:['火力太猛！','抬不起頭！'],pinned:['被壓住了！','動不了！'],
 spotted:['發現目標！','在那裡！'],lost:['跟丟了。','人呢？'],search:['搜索這一區。','他跑不遠。'],
};
const MACHINE={
 lurk:['〔靜默待命〕','〔等待〕'],
 grenade:['〔投擲程序〕'],bombard:['〔轟炸座標鎖定〕'],aim:['〔鎖定〕'],attack:['〔攻擊程序〕'],
 affix_fast:['〔加速模組〕'],affix_infrared:['〔紅外線模組〕'],affix_night_vision:['〔夜視模組〕'],affix_suppressor:['〔連射模組〕'],affix_grenadier:['〔投擲模組〕'],
 move:['〔移動〕'],cover:['〔規避〕'],hold:['〔固守〕'],reload:['〔裝填〕'],flank:['〔側翼路徑〕'],
 hit:['〔受損〕'],wounded:['〔損傷擴大〕'],critical:['〔系統危急〕'],suppressed:['〔訊號干擾〕'],pinned:['〔行動受阻〕'],
 spotted:['〔目標確認〕'],lost:['〔目標遺失〕'],search:['〔掃描中〕'],
};
// Creatures only make noises, so their lines follow the category rather than the exact cue.
const CREATURE={danger:['嘶嘶——！','咯咯咯！'],affix:['嘶——！'],tactical:['嘶……','咯……'],injury:['嘎——！','嗚……'],perception:['嘶？','咯……']};

// Voice ids index these tables; creature noises follow the category instead (3.79.1). Factions add their own ids.
const LOYALIST={
 lurk:['都別出聲。','就位，保持安靜。'],
 grenade:['投擲破片，隱蔽！','手榴彈出手，注意！'],bombard:['請求火力覆蓋！','座標回報，轟炸開始！'],aim:['目標鎖定，待命射擊。','狙擊位就緒。'],attack:['接敵，開火！','前進接戰！'],
 affix_fast:['加速推進！','機動班跟上！'],affix_infrared:['熱源掃描啟動。','紅外線確認目標。'],affix_night_vision:['夜視裝備就位。','暗區無礙，持續搜索。'],affix_suppressor:['壓制火力，掩護推進！','持續壓制！'],affix_grenadier:['擲彈手就位。','準備投擲支援。'],
 move:['推進，交互掩護！','保持隊形，向前！'],cover:['尋找掩蔽！','就掩體，回報位置！'],hold:['守住陣地！','原地堅守，等待命令！'],reload:['換彈，掩護我！','裝填中！'],flank:['側翼包抄，執行！','從側面迂迴！'],
 hit:['中彈，還能戰鬥！','被擊中，繼續任務！'],wounded:['傷勢加重，請求支援！','負傷，戰力下降！'],critical:['重傷！需要後送！','撐不住了，請求撤離！'],suppressed:['遭到壓制！','火力太強，無法抬頭！'],pinned:['被釘住了，無法移動！','動彈不得，請求掩護！'],
 spotted:['發現敵人，回報位置！','接觸！目標確認！'],lost:['目標脫離視線。','失去接觸，回報最後位置。'],search:['分區搜索，保持聯絡。','搜索前進，注意死角。'],
};
const REBEL={
 lurk:['噓……別出聲。','就等在這。'],
 grenade:['吃我一顆雷！','炸飛你這混蛋！'],bombard:['轟爛他們！','給我炸！'],aim:['別動，你這活靶……','瞄好了，等著吃子彈吧。'],attack:['衝啊，宰了他！','上！上！上！'],
 affix_fast:['跟不上就去死吧！','快點，別拖拖拉拉！'],affix_infrared:['躲煙裡也沒用！','看得一清二楚！'],affix_night_vision:['摸黑？我照樣看得見！','黑漆漆的正好。'],affix_suppressor:['給我狠狠地打！','子彈不要錢，掃！'],affix_grenadier:['來嚐嚐這個！','抱著炸藥去死吧！'],
 move:['往前壓，別當縮頭烏龜！','衝過去！'],cover:['找東西躲，笨蛋！','趴下，別送死！'],hold:['老子就站這！','有種過來啊！'],reload:['等我換彈，別催！','子彈沒了，該死！'],flank:['繞過去捅他後背！','從旁邊包抄，快！'],
 hit:['該死，被打中了！','混蛋，我中彈了！'],wounded:['可惡……還沒完！','痛死了，你給我記住！'],critical:['救我……誰來救我！','我不想死在這！'],suppressed:['火力也太猛了吧！','頭都抬不起來！'],pinned:['動不了，該死！','被釘死在這了！'],
 spotted:['在那！宰了他！','找到你了，雜碎！'],lost:['人呢？跑哪去了！','讓他溜了，該死！'],search:['給我搜，挖地三尺！','出來啊，別躲了！'],
 // 3.127.0 draft lines for the rebel who breaks (docs/REBELS.md); the user rewrites the voice.
 flee:['我不幹了！','掩護我，我要撤！'],rally:['知道了，別開槍！','我回來了，別看我！'],
};
// 3.127.1 drafts (user request: conscripts sounded as fierce as the rebels who dragged them in). Frightened, reluctant,
// apologising while they shoot. The user rewrites the voice.
const CONSCRIPT={
 lurk:['我、我在這等……','拜託別往這邊來……'],
 grenade:['我、我丟了！','對不起，快躲開！'],bombard:['要炸了，快跑！','別怪我……'],aim:['我瞄準了……拜託別動……','別逼我開槍……'],attack:['對不起！','我不想這樣……'],
 affix_fast:['我只想快點離開這裡！','別追我！'],affix_infrared:['煙裡也看得到你……求你別過來。','我看得到你……'],affix_night_vision:['這副眼鏡是他們硬塞給我的……','黑暗裡也看得見……'],affix_suppressor:['手在抖，停不下來！','子彈一直出來……'],affix_grenadier:['這東西會炸……','拜託別炸到我自己……'],
 move:['我去就是了……','別推我，我在走……'],cover:['讓我躲一下……','這裡安全嗎？'],hold:['我不動，我不動……','我就待在這……'],reload:['子彈……子彈在哪……','手一直抖，裝不進去！'],flank:['要我繞過去？……好吧。','為什麼又是我……'],
 hit:['啊！我中彈了！','好痛……'],wounded:['我要死了嗎……','誰來幫幫我……'],critical:['我不想死……','我只是被抓來的……'],suppressed:['頭抬不起來！','別打了！'],pinned:['我動不了……','別開槍，我投降……'],
 spotted:['有、有人！','他在那……天啊……'],lost:['他走了……太好了……','沒看到最好……'],search:['一定要找嗎……','拜託別讓我找到……'],
 flee:['我不幹了！','放我走！'],rally:['我去！我去就是了！','別殺我，我回去！'],
};
// 3.127.1 drafts: the enforcer. Cold, and loud only when it matters: the warning and the execution.
const ENFORCER={
 alarm:['敵人在此！全員就位！','發現敵人，誰敢後退就斃了誰！'],execute:['臨陣脫逃，殺無赦！','逃兵的下場，都給我看清楚！'],
 aim:['瞄準了。','別動。'],attack:['倒下。','開火。'],hold:['守住。','誰都不准退。'],cover:['找掩護。','壓低。'],move:['跟上。','前進。'],reload:['換彈。','掩護我換彈。'],flank:['包抄。','繞過去。'],
 hit:['擦傷而已。','……繼續打。'],wounded:['還撐得住。','別停火！'],critical:['給我……頂住……','誰都不准跑……'],suppressed:['壓不住我。','穩住！'],pinned:['……該死。','別停，繼續打！'],
 spotted:['在那。','目標確認。'],lost:['跟丟了。','目標消失，原地待命。'],search:['搜。','一格一格給我找。'],
};
// Civilians (3.82.1, docs/CIVILIANS.md 5): staff left behind in an ember facility. They know the war is lost, still wait
// for word from headquarters and recognise the numbered clones. No company names (docs/STORY.md 2). Only the cues the
// rules send for them are listed; anything else stays silent.
const CIVILIAN={
 scream:['警衛！警衛！有入侵者！','是數字人……快逃啊！','救命！他們打進來了！'],
 flee:['別過來！我們只是研究員！','戰爭早就結束了，放過我們吧！','我不知道總部在哪裡，我什麼都不知道！','這裡只剩下我們了……','我們只是在維持設施運轉……','求你，別傷害大家！'],
 hit:['啊！別開槍！','我投降，我投降！'],wounded:['求你……我們沒有武器……','住手，這裡沒有士兵！'],critical:['我只是……想回家……','我們只是在等命令……'],
 suppressed:['別打了，我趴下了！','不要開槍，我不動！'],pinned:['我動不了……別殺我！','拜託，放我走……'],
};
// Faction voices (3.80.0): loyalists report like a front line, rebels shout and curse. Machines keep MACHINE.
// Infected soldiers (3.83.0): the parasite is winning, so they mutter broken fragments of their old orders.
const INFECTED={
 lurk:['……等……等著……','……安靜……'],
 grenade:['……丟……丟出去……','炸……炸開牠們……'],bombard:['……座標……座標……'],aim:['……看……看得見……','別動……別……'],attack:['殺……殺……！','開火……開火開火……！'],
 affix_fast:['快……好快……'],affix_infrared:['……熱的……好熱……'],affix_night_vision:['黑……黑暗裡……看得見……'],affix_suppressor:['打……一直打……！'],affix_grenadier:['……炸藥……給我……'],
 move:['……往前……往前……','走……走……'],cover:['躲……要躲……'],hold:['……不走……不走……'],reload:['……子彈……子彈呢……'],flank:['……繞……繞過去……'],
 hit:['啊啊……！','痛……不痛……？'],wounded:['……裡面……在動……'],critical:['……讓牠們……出來……','好癢……好癢……'],suppressed:['……吵……好吵……'],pinned:['……動……動不了……'],
 spotted:['……人……活的人……','在那……在那……'],lost:['……不見了……'],search:['……找……聞得到……'],
};
export const VOICES={human:HUMAN,machine:MACHINE,loyalist:LOYALIST,rebel:REBEL,civilian:CIVILIAN,infected:INFECTED,conscript:CONSCRIPT,enforcer:ENFORCER};
export {CREATURE};
