# ADR-002: サーバーレス・コンテナアーキテクチャ

## ステータス
承認済み

## コンテキスト
計算負荷の高い最適化処理と、軽快なUI操作を両立させる必要がある。デモ開発としてのスピード感も重視する。

## 決定
GCP (Cloud Run) + Firebase の構成を採用する。

### 構成詳細
- **Frontend**: React / Next.js → Firebase Hosting
- **Backend/DB**: Firebase Authentication, Cloud Firestore
- **Optimization Logic**: Pythonコンテナ → Cloud Run

## 理由
- Cloud Runは計算リクエスト時のみインスタンスを起動・スケールでき、コスト効率が良い
- Firestoreのリアルタイムリスナー機能により、AIの計算結果を即座にUIへ反映できる
- 将来的な並列計算（パーティショニング）にもCloud Runは適している
