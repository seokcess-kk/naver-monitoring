import streamlit as st
import requests
import pandas as pd
import plotly.graph_objects as go
import time
import hmac
import hashlib
import base64
from datetime import datetime, timedelta

# ========================================================
# [설정] 페이지 기본 설정
# ========================================================
st.set_page_config(page_title="Keyword Insight (Total)", page_icon="📈", layout="wide")

# ========================================================
# [핵심] API 키 관리 (secrets.toml 우선 로드)
# ========================================================
def load_api_keys():
    """
    secrets.toml 파일에서 키를 로드합니다.
    파일이 없거나 키가 없으면 경고 메시지를 띄웁니다.
    """
    try:
        secrets = st.secrets["naver_api"]
        return {
            "AD_API_KEY": secrets["AD_API_KEY"],
            "AD_SECRET_KEY": secrets["AD_SECRET_KEY"],
            "AD_CUSTOMER_ID": str(secrets["AD_CUSTOMER_ID"]), # 문자로 변환
            "DATALAB_ID": secrets["DATALAB_CLIENT_ID"],
            "DATALAB_SECRET": secrets["DATALAB_CLIENT_SECRET"],
            "success": True
        }
    except Exception:
        return {"success": False}

# ========================================================
# [함수] API 호출 및 데이터 처리 (캐싱 적용)
# ========================================================
@st.cache_data(ttl=3600)
def get_total_volume(keyword, keys):
    """광고 API: 현재 시점의 총 검색량(기준값) 확보"""
    uri = '/keywordstool'
    method = 'GET'
    timestamp = str(int(time.time() * 1000))
    
    # 서명 생성
    secret_key = keys["AD_SECRET_KEY"].strip()
    message = "{}.{}.{}".format(timestamp, method, uri)
    hash = hmac.new(bytes(secret_key, "utf-8"), bytes(message, "utf-8"), hashlib.sha256)
    signature = base64.b64encode(hash.digest())
    
    headers = {
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Timestamp': timestamp,
        'X-API-KEY': keys["AD_API_KEY"],
        'X-Customer': keys["AD_CUSTOMER_ID"], 
        'X-Signature': signature
    }
    
    try:
        clean_keyword = keyword.replace(" ", "")
        response = requests.get('https://api.searchad.naver.com' + uri, params={'hintKeywords': clean_keyword, 'showDetail': '1'}, headers=headers)
        
        if response.status_code != 200:
            return {"success": False, "msg": f"Ad API Error {response.status_code}: {response.text}"}
            
        data = response.json()
        kwd_list = data.get('keywordList', [])
        
        target_item = None
        for item in kwd_list:
            if item['relKeyword'].replace(" ", "") == clean_keyword:
                target_item = item
                break
        
        # 정확한 일치가 없으면 첫 번째 결과 사용
        if target_item is None and kwd_list:
            target_item = kwd_list[0]

        if target_item:
            pc_cnt = target_item['monthlyPcQcCnt']
            mo_cnt = target_item['monthlyMobileQcCnt']
            
            # < 10 처리를 5로 설정
            pc_vol = 5 if str(pc_cnt).startswith("<") else int(pc_cnt)
            mo_vol = 5 if str(mo_cnt).startswith("<") else int(mo_cnt)
            
            return {
                "success": True,
                "data": {
                    'keyword': target_item['relKeyword'],
                    'total_vol': pc_vol + mo_vol,
                    'comp_idx': target_item['compIdx']
                }
            }
        return {"success": False, "msg": "검색 결과가 없습니다. (검색량 부족 또는 오타)"}
    except Exception as e:
        return {"success": False, "msg": str(e)}

@st.cache_data(ttl=3600)
def get_trend_data(keyword, start_date, end_date, keys):
    """데이터랩 API: 통합 트렌드 조회"""
    url = "https://openapi.naver.com/v1/datalab/search"
    headers = {
        "X-Naver-Client-Id": keys["DATALAB_ID"],
        "X-Naver-Client-Secret": keys["DATALAB_SECRET"],
        "Content-Type": "application/json"
    }
    body = {
        "startDate": start_date,
        "endDate": end_date,
        "timeUnit": "month",
        "keywordGroups": [{"groupName": keyword, "keywords": [keyword]}],
    }

    try:
        response = requests.post(url, headers=headers, json=body)
        if response.status_code == 200:
            return response.json()
        return None
    except:
        return None

# ========================================================
# [메인] UI 구성
# ========================================================
st.title("📈 Total Search Volume (Auto-Login)")

# 1. 키 로드 시도
api_keys = load_api_keys()

# 사이드바 상태 표시
with st.sidebar:
    st.header("⚙️ 시스템 상태")
    if api_keys["success"]:
        st.success("✅ API 키 로드 완료 (secrets.toml)")
        st.info("파일에서 키를 불러왔으므로 별도 입력이 필요 없습니다.")
    else:
        st.error("❌ API 키 파일 없음")
        st.warning("`.streamlit/secrets.toml` 파일을 확인해주세요.")
        st.markdown("[설정 방법 보러가기](#설정-가이드)")

col1, col2 = st.columns([1, 2])
with col1:
    target_keyword = st.text_input("분석 키워드", value="캠핑의자")
with col2:
    today = datetime.now().date()
    start_date = st.date_input("시작일", value=today - timedelta(days=370))
    end_date = st.date_input("종료일", value=today)

if st.button("분석 실행", type="primary"):
    if not api_keys["success"]:
        st.error("API 키를 찾을 수 없어 분석을 실행할 수 없습니다.")
    else:
        with st.spinner("통합 데이터 분석 중..."):
            
            # 1. 광고 API 호출
            ad_res = get_total_volume(target_keyword, api_keys)
            
            if ad_res.get("success"):
                ad_data = ad_res["data"]
                real_kwd = ad_data['keyword']
                current_total_vol = ad_data['total_vol']
                
                # 2. 데이터랩 호출
                s_date = start_date.strftime("%Y-%m-%d")
                e_date = end_date.strftime("%Y-%m-%d")
                
                raw_data = get_trend_data(real_kwd, s_date, e_date, api_keys)
                
                # 3. 데이터 가공
                df = pd.DataFrame()
                if raw_data and 'results' in raw_data:
                    items = raw_data['results'][0]['data']
                    df = pd.DataFrame(items)
                    df.columns = ['날짜', '비율']
                    
                    last_ratio = df.iloc[-1]['비율']
                    multiplier = current_total_vol / last_ratio if last_ratio > 0 else 0
                    
                    df['검색량'] = (df['비율'] * multiplier).round(0).astype(int)
                
                if not df.empty:
                    # 성장률 계산
                    mom_growth = 0
                    yoy_growth = 0
                    
                    if len(df) >= 2:
                        curr = df.iloc[-1]['검색량']
                        prev = df.iloc[-2]['검색량']
                        if prev > 0: mom_growth = ((curr - prev) / prev) * 100
                    
                    has_yoy = False
                    if len(df) >= 13:
                        curr = df.iloc[-1]['검색량']
                        prev_yr = df.iloc[-13]['검색량']
                        if prev_yr > 0: 
                            yoy_growth = ((curr - prev_yr) / prev_yr) * 100
                            has_yoy = True

                    # ----------------------------------
                    # 결과 렌더링
                    # ----------------------------------
                    st.markdown("---")
                    
                    k1, k2, k3, k4 = st.columns(4)
                    k1.metric("키워드", real_kwd)
                    k2.metric("총 검색량 (30일)", f"{current_total_vol:,}")
                    k3.metric("전월 대비 (MoM)", f"{mom_growth:+.1f}%", delta_color="normal")
                    yoy_str = f"{yoy_growth:+.1f}%" if has_yoy else "-"
                    k4.metric("전년 대비 (YoY)", yoy_str, delta_color="normal")
                    
                    st.subheader(f"📊 '{real_kwd}' 월별 전체 검색량")
                    
                    fig = go.Figure()
                    fig.add_trace(go.Scatter(
                        x=df['날짜'], 
                        y=df['검색량'], 
                        mode='lines', 
                        name='Total Volume',
                        fill='tozeroy', 
                        line=dict(color='#03C75A', width=3),
                        fillcolor='rgba(3, 199, 90, 0.2)'
                    ))
                    
                    fig.update_layout(
                        hovermode='x unified',
                        yaxis_tickformat=',',
                        height=500
                    )
                    st.plotly_chart(fig, use_container_width=True)
                    
                    with st.expander("데이터 표 보기 / 다운로드"):
                        csv = df.to_csv(index=False).encode('utf-8-sig')
                        st.download_button("CSV 다운로드", csv, f"{real_kwd}_total.csv", "text/csv")
                        
                        show_df = df.copy()
                        show_df['검색량'] = show_df['검색량'].apply(lambda x: f"{x:,}")
                        st.dataframe(show_df, use_container_width=True)
                else:
                    st.warning("트렌드 데이터를 가져올 수 없습니다.")
            else:
                st.error(f"오류: {ad_res.get('msg')}")

# ========================================================
# [설정 가이드] 하단 안내
# ========================================================
if not api_keys["success"]:
    st.markdown("---")
    st.markdown("### 🛠️ 설정 가이드")
    st.info("이 앱은 `secrets.toml` 파일을 사용하여 API 키를 관리합니다.")
    st.code("""
# .streamlit/secrets.toml 파일을 만들고 아래 내용을 채워주세요.

[naver_api]
AD_API_KEY = "내_검색광고_라이선스_키"
AD_SECRET_KEY = "내_검색광고_시크릿_키"
AD_CUSTOMER_ID = "123456"
DATALAB_CLIENT_ID = "내_데이터랩_Client_ID"
DATALAB_CLIENT_SECRET = "내_데이터랩_Client_Secret"
    """, language="toml")