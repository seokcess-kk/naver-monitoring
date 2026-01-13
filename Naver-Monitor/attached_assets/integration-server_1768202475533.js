const express = require('express');
const cors = require('cors');
const axios = require('axios');
const puppeteer = require('puppeteer');
const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// ==========================================
// [Part 1] 네이버 검색 API 핸들러
// ==========================================
async function callNaverApi(url, req, res) {
    const { query, display, start, sort } = req.query;
    
    const clientId = (req.headers['x-naver-client-id'] || '').trim();
    const clientSecret = (req.headers['x-naver-client-secret'] || '').trim();

    if (!query || !clientId || !clientSecret) {
        return res.status(400).json({ error: '필수 파라미터가 누락되었습니다.' });
    }

    try {
        const apiResponse = await axios.get(url, {
            params: { query, display: display || 10, start: start || 1, sort: sort || 'sim' },
            headers: { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret }
        });
        res.json(apiResponse.data);
    } catch (error) {
        const status = error.response ? error.response.status : 500;
        if (error.response) res.status(status).json(error.response.data);
        else res.status(500).json({ error: 'Internal Server Error' });
    }
}

app.get('/search/blog', (req, res) => callNaverApi('https://openapi.naver.com/v1/search/blog.json', req, res));
app.get('/search/cafe', (req, res) => callNaverApi('https://openapi.naver.com/v1/search/cafearticle.json', req, res));
app.get('/search/kin', (req, res) => callNaverApi('https://openapi.naver.com/v1/search/kin.json', req, res));
app.get('/search/news', (req, res) => callNaverApi('https://openapi.naver.com/v1/search/news.json', req, res));

// ==========================================
// [Part 2] 통합 크롤링 (플레이스 상단 고정 + 상세정보 제외)
// ==========================================
app.get('/crawl/naver', async (req, res) => {
    const { keyword } = req.query;
    console.log(`🔍 [크롤링] 검색어: ${keyword}`);

    if (!keyword) return res.status(400).json({ error: '검색어가 없습니다.' });

    let browser = null;

    try {
        browser = await puppeteer.launch({
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 1080 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36');

        const url = `https://search.naver.com/search.naver?query=${encodeURIComponent(keyword)}`;
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        const extractedData = await page.evaluate(() => {
            const sections = [];
            const processedElements = new Set();

            // ----------------------------------------------------
            // 1. 플레이스(지도) 영역 추출 (기존 DOM 방식 유지, 상세정보 X)
            // ----------------------------------------------------
            const placeSection = document.querySelector('#loc-main-section-root') || 
                                 document.querySelector('#place-main-section-root') || 
                                 document.querySelector('[data-laim-exp-id*="loc_plc"]') || 
                                 document.querySelector('[data-laim-exp-id*="nmb_hpl"]') ||
                                 document.querySelector('.api_subject_bx[data-template-type="place"]');
            
            if (placeSection) {
                processedElements.add(placeSection);
                const placePosts = [];
                const listItems = placeSection.querySelectorAll('li');
                
                let rankCounter = 1;

                listItems.forEach((li) => {
                    try {
                        const docId = li.getAttribute('data-loc_plce-doc-id') || 
                                      li.getAttribute('data-loc_plc-doc-id') || 
                                      li.getAttribute('data-nmb_hpl-doc-id') || 
                                      li.getAttribute('data-doc-id') || "";
                        
                        // 광고 제외
                        if (docId.includes('nad') || li.classList.contains('type_ad') || li.getAttribute('data-nclk')?.includes('ads')) return;

                        let nameEl = li.querySelector('.YwYLL') || li.querySelector('.q2LdB') || li.querySelector('.tit_place') || li.querySelector('.place_bluelink');
                        let linkEl = li.querySelector('a.place_bluelink') || li.querySelector('a[href*="map.naver.com"]') || li.querySelector('a');

                        if (nameEl) {
                            placePosts.push({
                                rank: rankCounter++,
                                title: nameEl.innerText.trim(),
                                // 플레이스 URL은 파라미터 제거 (깔끔하게)
                                url: linkEl ? linkEl.href.split('?')[0] : "#",
                                summary: "네이버 플레이스",
                                isPlace: true
                            });
                        }
                    } catch (e) {}
                });

                if (placePosts.length > 0) {
                    sections.push({
                        sectionTitle: "📍 플레이스 (지도)",
                        posts: placePosts
                    });
                }
            }

            // ----------------------------------------------------
            // 2. 뉴스 영역 추출 (기존 로직 유지, URL 파라미터 보존)
            // ----------------------------------------------------
            const newsSection = document.querySelector('div[data-meta-area="nws_all"]') || 
                                document.querySelector('.group_news') || 
                                document.querySelector('.news_area');

            if (newsSection) {
                // 뉴스 섹션의 상위 박스를 찾아 처리됨으로 표시
                const parentBox = newsSection.closest('.api_subject_bx');
                if (parentBox) processedElements.add(parentBox);

                const newsPosts = [];
                // 다양한 뉴스 구조 대응
                const newsItems = newsSection.querySelectorAll('.news_wrap, .bx, .list_news > .bx, .sds-comps-vertical-layout .sds-comps-full-layout.BA4AED65Uniq0oRiPaDB, div[data-template-id="newsItem"]');

                newsItems.forEach((item, index) => {
                    try {
                        // 제목 찾기 (data-heatmap-target 우선)
                        let titleEl = item.querySelector('a[data-heatmap-target=".tit"]');
                        if (!titleEl) titleEl = item.querySelector('.news_tit') || item.querySelector('.sds-comps-text-type-headline1');
                        
                        // 링크 찾기
                        let anchorEl = titleEl ? (titleEl.tagName === 'A' ? titleEl : titleEl.closest('a')) : item.querySelector('a');

                        // 요약 찾기
                        const summaryEl = item.querySelector('a[data-heatmap-target=".body"]') || 
                                          item.querySelector('.dsc_txt_wrap') || 
                                          item.querySelector('.sds-comps-text-type-body1') || 
                                          item.querySelector('.api_txt_lines.dsc_txt');
                        
                        // 언론사 & 날짜
                        const pressEl = item.querySelector('.info_group .press') || item.querySelector('.sds-comps-profile-info-title-text') || item.querySelector('a[data-heatmap-target=".prof"]');
                        const dateEl = item.querySelector('.info_group .info') || item.querySelector('.sds-comps-profile-info-subtext');

                        if (titleEl && anchorEl && anchorEl.href) {
                            newsPosts.push({
                                rank: index + 1,
                                title: titleEl.innerText.trim(),
                                // [중요] 뉴스는 파라미터가 있어야 접속 가능하므로 전체 URL 사용
                                url: anchorEl.href, 
                                summary: summaryEl ? summaryEl.innerText.trim() : "",
                                isPlace: false,
                                isNews: true,
                                press: pressEl ? pressEl.innerText.trim() : "",
                                date: dateEl ? dateEl.innerText.trim() : ""
                            });
                        }
                    } catch (e) {}
                });

                if (newsPosts.length > 0) {
                    sections.push({
                        sectionTitle: "📰 뉴스",
                        posts: newsPosts
                    });
                }
            }

            // ----------------------------------------------------
            // 3. 일반 스마트블록 / 뷰 영역 추출
            // ----------------------------------------------------
            const boxes = document.querySelectorAll('div.api_subject_bx');

            boxes.forEach((box) => {
                // 이미 처리된 섹션 건너뜀
                if (processedElements.has(box) || 
                    box.closest('[data-meta-area="nws_all"]') || 
                    box.getAttribute('data-laim-exp-id')?.includes('loc_plc')) return;

                const headerEl = box.querySelector('div[data-template-id="header"] h2') || 
                                 box.querySelector('.api_title_area h2') || 
                                 box.querySelector('.tit_chunk');

                const items = box.querySelectorAll('div[data-template-id="ugcItem"], div[data-template-id="webItem"], li.bx');
                const posts = [];

                if (headerEl && items.length > 0) {
                    const sectionTitle = headerEl.innerText.trim();
                    if (sectionTitle.includes("뉴스")) return; // 중복 방지

                    items.forEach(item => {
                        try {
                            const titleEl = item.querySelector('.sds-comps-text-type-headline1') || 
                                          item.querySelector('.news_tit') || 
                                          item.querySelector('.api_txt_lines.tit') ||
                                          item.querySelector('.total_tit');
                            
                            const summaryEl = item.querySelector('.sds-comps-text-type-body1') || 
                                            item.querySelector('.dsc_txt');

                            const anchorEl = titleEl ? titleEl.closest('a') : item.querySelector('a');

                            if (titleEl && anchorEl && anchorEl.href) {
                                // 일반 게시글 URL도 파라미터 유지
                                const url = anchorEl.href;
                                if (!posts.some(p => p.url === url)) {
                                    posts.push({
                                        rank: null,
                                        title: titleEl.innerText.trim(),
                                        url: url,
                                        summary: summaryEl ? summaryEl.innerText.trim() : "",
                                        isPlace: false
                                    });
                                }
                            }
                        } catch (e) {}
                    });

                    if (posts.length > 0) {
                        sections.push({
                            sectionTitle: sectionTitle,
                            posts: posts
                        });
                    }
                }
            });

            // ======================================================
            // 4. [정렬] 플레이스 섹션 최상단 고정 (요청사항 반영)
            // ======================================================
            const placeIdx = sections.findIndex(s => s.sectionTitle.includes("플레이스") || s.sectionTitle.includes("지도"));
            if (placeIdx > 0) {
                // 플레이스 섹션을 배열에서 빼내서(splice) 맨 앞(unshift)으로 이동
                const placeSection = sections.splice(placeIdx, 1)[0];
                sections.unshift(placeSection);
            }

            return sections;
        });

        const totalCount = extractedData.reduce((acc, curr) => acc + curr.posts.length, 0);
        console.log(`✅ [성공] 플레이스/뉴스 포함 총 ${extractedData.length}개 섹션 추출 완료`);

        res.json({
            keyword: keyword,
            totalPosts: totalCount,
            data: extractedData
        });

    } catch (error) {
        console.error('❌ [크롤링 에러]', error);
        res.status(500).json({ error: '크롤링 실패', details: error.message });
    } finally {
        if (browser) await browser.close();
    }
});

app.listen(PORT, () => {
    console.log(`🚀 서버 실행 중: http://localhost:${PORT}`);
});