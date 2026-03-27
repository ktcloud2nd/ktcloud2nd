-- 계획 변경으로 전체 주석 처리 (추후 수정 예정)

/*
-- 차종 코드 테이블: 부모
CREATE TABLE IF NOT EXISTS model_codes (
    code          INT PRIMARY KEY,      -- 1, 2, 3, 4
    model_name    VARCHAR(50) NOT NULL, -- 차종
    image_url     TEXT                  -- S3 버킷 이미지 경로
);

INSERT INTO model_codes (code, model_name, image_url) VALUES
(1, 'Avante', 'https://ktcloud2nd-dev-data.s3.ap-northeast-2.amazonaws.com/models/avante.png'),
(2, 'Granduer', 'https://ktcloud2nd-dev-data.s3.ap-northeast-2.amazonaws.com/models/granduer.png'),
(3, 'Santafe', 'https://ktcloud2nd-dev-data.s3.ap-northeast-2.amazonaws.com/models/santafe.png'),
(4, 'Tucson', 'https://ktcloud2nd-dev-data.s3.ap-northeast-2.amazonaws.com/models/tucson.png')
ON CONFLICT (code) DO NOTHING;

-- 사용자 테이블: 자식
CREATE TABLE IF NOT EXISTS vehicle_master (
    id            SERIAL PRIMARY KEY,
    user_id       VARCHAR(50) NOT NULL,
    password      VARCHAR(255) NOT NULL,
    user_name     VARCHAR(100),
    vehicle_id    VARCHAR(50) UNIQUE,
    model_code    INT REFERENCES model_codes(code) -- 외래키 참조
);

INSERT INTO vehicle_master (user_id, password, user_name, vehicle_id, model_code) VALUES
('user01', 'pass01!', '강동훈', 'car_1', 1),
('user02', 'pass02!', '이정수', 'car_2', 2),
('user03', 'pass03!', '박서현', 'car_3', 3),
('user04', 'pass04!', '최윤지', 'car_4', 4)
ON CONFLICT (vehicle_id) DO NOTHING;
*/

-- 정제 데이터 테이블
CREATE TABLE IF NOT EXISTS vehicle_stats (
    id SERIAL PRIMARY KEY,
    vehicle_id VARCHAR(50) NOT NULL,
    timestamp BIGINT NOT NULL,        -- 시뮬레이터의 timestamp (Unix Time)
    lat DOUBLE PRECISION,
    lon DOUBLE PRECISION,
    speed INT,
    engine_on BOOLEAN,
    fuel_level NUMERIC(5, 2),
    event_type INT,
    mode INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- DB 입력 시각
);

-- 성능을 위해 차량 ID와 시간으로 인덱스 생성
CREATE INDEX idx_vehicle_timestamp ON vehicle_stats(vehicle_id, timestamp DESC);

-- 이상 탐지 알람 테이블
CREATE TABLE IF NOT EXISTS vehicle_anomaly_alerts (
    id SERIAL PRIMARY KEY,
    alert_time BIGINT NOT NULL,       -- 서버가 탐지한 시각 (Unix Time)
    vehicle_id VARCHAR(50) NOT NULL,
    anomaly_type VARCHAR(100),        -- DATA_BURST, SUDDEN_ACCEL, MISSING_DATA 등
    description TEXT,
    occurred_at BIGINT,               -- 시뮬레이터에서 실제 발생한 시각
    raw_data JSONB,                   -- 당시의 원본 데이터 전체를 JSON 형태로 저장 (분석용)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 알람 종류별로 빠르게 필터링하기 위한 인덱스
CREATE INDEX idx_anomaly_type ON vehicle_anomaly_alerts(anomaly_type);