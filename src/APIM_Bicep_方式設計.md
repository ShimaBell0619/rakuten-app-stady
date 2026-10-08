# APIM Bicep 管理方式設計（改訂版）

改訂日：2026年10月8日  
対象：Bookingシステム（DEV / UAT / PROD / DR）、Azure Pipelines  
目的：APIM本体・API定義・PolicyをGitで管理する方式の整理。既存コードおよびAzure環境の変更は対象外。

## 1. 設計方針と推奨方式

**既存の`bicep/templates/booking.bicep`を唯一のデプロイ入口とし、APIMのAPI定義・Policy本文はトップレベルの`apim/`に分離する。** APIMのリソース作成はBicepの共通モジュールで扱い、APIOps CLIは導入しない。

| 項目 | 採用方式・理由 |
| --- | --- |
| デプロイ入口 | `booking.bicep`に統合。APIの更新頻度が低いため、基盤とAPI設定に別々の入口・パラメーターを設けない。 |
| リソースの実装 | `bicep/modules/apiManagement/`へ分離。テンプレートを統合しても、モジュールの責務は分ける。 |
| APIのソース | `apim/apis/<API識別子>/openapi.yaml`を正とする。アプリ担当者が仕様を編集する。 |
| Policyのソース | 必要なスコープだけXMLファイルを置く。API・Operationごとの不要なPolicyを作成しない。 |
| 環境差分 | `bicep/environments/<環境>/booking.bicepparam`で管理。OpenAPIとPolicyを環境別に複製しない。 |
| 登録方式 | `booking.bicep`へAPIを明示的に登録する。自動探索・独自マニフェスト・コード生成は導入しない。 |
| デプロイ方式 | 既存Azure Pipelinesで`booking.bicep`を増分デプロイ。基盤・API設定を**同じ実行単位**で扱う。 |

**判断根拠：** APIの更新頻度が低く、既存のインフラ変更も限定的という今回の前提では、デプロイ入口を分離して得られる利点より、パラメーター・依存関係・反映漏れを管理する負担の方が大きい。ただし、**1つの入口に統合してもARMデプロイがトランザクションになるわけではなく、途中失敗時の部分反映は起こり得る**。また、既存リソースを含むテンプレートを再デプロイすると、宣言したプロパティは再適用される。〔14〕

### 1.1 公式サンプル・APIOps CLIとの位置づけ

MicrosoftのAPIM QuickstartではBicepやARMテンプレートによるリソース定義が示されている。APIOps CLIではAPI定義とPolicyをスコープごとのファイルに分けて管理する。いずれも参考になるが、**これらのリポジトリ構成はBicep管理時の必須仕様ではない**。本方式はAPI単位でまとめる考え方だけを採用する。〔1、2、3〕

| 方式 | 判断 |
| --- | --- |
| BicepでAPIM本体・API・Policyを管理 | **採用**。既存のIaCとPipelineに統一できる。 |
| Bicep＋APIOps CLI | 不採用。実環境からの抽出、API差分だけの公開などが必要になった時点で再評価する。 |

APIOps CLIの成果物形式に合わせることは目的としない。旧`Azure/apiops`の構成をそのまま新規導入しない。〔3、4、5〕

## 2. ディレクトリ構成

以下が採用構成。`01-dev`以外の環境ディレクトリ名は**既存の命名規則を踏襲**する。Policy関連のディレクトリとファイルは必要になった場合だけ追加する。

```text
repository/
├─ bicep/
│  ├─ modules/
│  │  └─ apiManagement/
│  │     ├─ apim-service.bicep       # APIM本体のモジュール
│  │     └─ apim-api.bicep           # API・API/Operation Policy共通モジュール
│  ├─ templates/
│  │  └─ booking.bicep              # 基盤・APIM設定共通のデプロイ入口
│  └─ environments/
│     ├─ 01-dev/
│     │  └─ booking.bicepparam
│     └─ <既存の他環境ディレクトリ>/
│        └─ booking.bicepparam
│
└─ apim/
   ├─ apis/
   │  └─ booking/
   │     ├─ openapi.yaml
   │     ├─ policy.xml               # API固有処理が必要な場合だけ
   │     └─ operations/             # Operation固有処理が必要な場合だけ
   │        └─ get-booking/
   │           └─ policy.xml
   ├─ service/                       # Global Policyが必要な場合だけ
   │  └─ policy.xml
   └─ policy-fragments/             # 再利用するFragmentが必要な場合だけ
      └─ <fragment-id>.xml
```

`apim/`配下は**APIMへ登録する論理定義**、`bicep/`配下は**Azureリソースへの反映方法と環境設定**として整理する。`apim-config.bicep`とAPIM専用の`.bicepparam`は作成しない。

### 2.1 各ファイルの役割

| 配置 | 役割 |
| --- | --- |
| `modules/apiManagement/apim-service.bicep` | APIM本体のリソース定義。既存の同等モジュールがある場合はそれを移設・再利用する想定。 |
| `modules/apiManagement/apim-api.bicep` | OpenAPIからのAPI登録、必要なAPI/Operation Policyの適用。APIごとに複製しない。 |
| `templates/booking.bicep` | 既存基盤に加えてAPI登録の組み立てとファイル参照を管理する。 |
| `environments/<環境>/booking.bicepparam` | `using '../../templates/booking.bicep'`により共通テンプレートへ渡す環境別の値。 |
| `apim/apis/<ID>/openapi.yaml` | HTTPメソッド、パス、要求・応答、固定`operationId`を定義する。 |
| `apim/apis/<ID>/policy.xml` | API固有Policy。不要な場合は作成しない。 |
| `operations/<operationId>/policy.xml` | Operation固有Policy。Operation自体はOpenAPIで定義する。 |
| `apim/service/policy.xml` | 全APIで共有するGlobal Policyが必要な場合のみ使用する。 |
| `apim/policy-fragments/*.xml` | 複数のPolicyから参照する処理がある場合のみ使用する。 |

## 3. 管理責任と変更方法

| 対象 | 主な変更担当 | レビュー |
| --- | --- | --- |
| APIM本体・ネットワーク・Managed Identity・Azure RBAC | 基盤 | 基盤 |
| OpenAPI | アプリ | アプリ。API追加・削除・公開パス/識別子変更時は基盤も確認 |
| API/Operation Policy | アプリ（必要に応じ基盤） | 認証・認可、`<base />`、Backendに関わる変更は基盤が必ず確認 |
| Global Policy / Fragment | 基盤 | 基盤、必要に応じ影響先のアプリ |
| Backend URL、Named Value、環境値、共通Bicep | 基盤 | 基盤。アプリ接続仕様に関わる場合はアプリも確認 |
| Pipeline | 基盤 | 基盤 |

アプリ担当者は通常、`apim/apis/<API識別子>/`だけを編集する。新しいAPI、Policy参照、Operation Policyを追加する場合は、基盤担当者が`booking.bicep`にも登録する。ディレクトリを分けてもGitの編集権限は自動で分離されないため、既存のPR・必須レビューポリシーで制御する。本番APIMの直接編集・直接デプロイを通常手順にしない。

## 4. BicepからOpenAPI・Policyを取り込む方式

### 4.1 ファイル読み込み

`loadTextContent()`は**Bicepのコンパイル時**にファイル本文をARMテンプレートへ取り込む。ファイルパスは関数を書いたBicepファイル基準の相対パスであり、実行時のパラメーターやAPI名から動的に組み立てることはできない。1ファイルの最大は改行込み131,072文字である。〔6〕

今回の正しい参照パスは次のとおり。

```bicep
// bicep/templates/booking.bicep 内で実行
var openApi = loadTextContent('../../apim/apis/booking/openapi.yaml')
```

OpenAPIを`format: 'openapi'`で、API/Operation Policyを`format: 'rawxml'`でAPIMへ渡す。OpenAPIは原則3.0.3とし、外部ファイルへの`$ref`はデプロイ前に解消する。3.1はインポートできても全機能が同等に利用できるわけではない。〔7、8〕

**Policyが不要な場合はファイルを置かず、Bicepにも`loadTextContent()`を記述しない。** BicepがXMLファイルの有無を実行時に自動判定する仕組みは導入しない。

### 4.2 最小Bicep実装イメージ

以下は**既存`booking.bicep`へ追加する箇所の抜粋**。既存基盤モジュールや実際のパラメーター名は提示されていないため、省略している。`apimService`は既存のAPIM作成モジュールのシンボル名を想定する。コードは方式説明用であり、コンパイル・実デプロイは未検証。

`bicep/templates/booking.bicep`（抜粋）：

```bicep
// 既存テンプレート側のパラメーターを利用する想定
// param apimName string
// param bookingBackendUrl string
// param subscriptionRequired bool

var apis = [
  {
    apiId: 'booking'
    displayName: 'Booking API'
    path: 'booking'
    backendUrl: bookingBackendUrl
    openApi: loadTextContent('../../apim/apis/booking/openapi.yaml')
    apiPolicy: loadTextContent('../../apim/apis/booking/policy.xml')
    operationPolicies: []
  }
]

module apiModules '../modules/apiManagement/apim-api.bicep' = [for item in apis: {
  name: 'apim-api-${item.apiId}'
  params: {
    apimName: apimName
    apiId: item.apiId
    displayName: item.displayName
    apiPath: item.path
    backendUrl: item.backendUrl
    subscriptionRequired: subscriptionRequired
    openApi: item.openApi
    apiPolicy: item.apiPolicy
    operationPolicies: item.operationPolicies
  }
  dependsOn: [apimService] // 実際のAPIM本体モジュールの名前に合わせる
}]
```

`bicep/modules/apiManagement/apim-api.bicep`（抜粋）：

```bicep
param apimName string
param apiId string
param displayName string
param apiPath string
param backendUrl string
param subscriptionRequired bool
param openApi string
param apiPolicy string = ''
param operationPolicies array = []

resource apim 'Microsoft.ApiManagement/service@2024-05-01' existing = {
  name: apimName
}

resource api 'Microsoft.ApiManagement/service/apis@2024-05-01' = {
  parent: apim
  name: apiId
  properties: {
    displayName: displayName
    path: apiPath
    protocols: ['https']
    serviceUrl: backendUrl
    subscriptionRequired: subscriptionRequired
    format: 'openapi'
    value: openApi
  }
}

resource apiPolicyResource 'Microsoft.ApiManagement/service/apis/policies@2024-05-01' = if (apiPolicy != '') {
  parent: api
  name: 'policy'
  properties: {
    format: 'rawxml'
    value: apiPolicy
  }
}

resource operationPolicyResources 'Microsoft.ApiManagement/service/apis/operations/policies@2024-05-01' = [for item in operationPolicies: {
  name: '${apimName}/${apiId}/${item.operationId}/policy'
  properties: {
    format: 'rawxml'
    value: item.policy
  }
  dependsOn: [api] // OpenAPIによるOperationインポートの完了待ち
}]
```

API固有PolicyがないAPIは、登録オブジェクトの`apiPolicy`に`''`を指定し、該当する`loadTextContent()`呼び出しを書かない。Operation Policyを追加する場合だけ`operationPolicies`へ固定の`operationId`とXML本文を登録する。条件付きデプロイでAPI Policyを作成しないことと、**既存API Policyを削除することは別の操作**である。〔9、10〕

### 4.3 デプロイの依存関係

同じ`booking.bicep`内で、**APIM本体 → APIインポート → API/Operation Policy**の依存関係を管理する。APIMを`existing`で参照するモジュールは、それだけでは本体モジュールの完了を待たないため、上記のように依存を明示する。Named Value、Backend、Fragment、Global Policyを実際に利用する場合は、それらが参照元Policyより前に作成される依存関係も設定する。XML中の`{{name}}`や`fragment-id`からBicepが依存関係を推論することはない。〔11〕

Global Policyを使う場合は、新規APIを公開する前に認証・認可が有効であることを確認する。新規API作成とPolicy適用の途中で失敗すると、APIだけが作成済みになる可能性があるためである。

### 4.4 サイズ制限

1つのOpenAPIが`loadTextContent()`の上限を超える場合は、実際のファイルサイズと生成ARMテンプレートの上限を確認したうえで`loadYamlContent()`や別のインポート手段を検討する。現時点では大型API対応の変換スクリプト等を追加しない。〔6、8、12〕

## 5. Backendおよび環境差分

**標準はAPIリソースの`serviceUrl`で接続先を設定する方式とする。** 現時点でBackendリソースが必須になる具体的要件が示されていないため、APIごとにBackendリソースとNamed Valueを作る構成は採用しない。

| 要件 | 採用方式 |
| --- | --- |
| 単純なバックエンドURL指定 | APIの`serviceUrl`を使用。環境ごとのURLは`booking.bicepparam`から渡す。 |
| Backendの認証設定・共通管理などの機能が必要 | そのAPIでBackendリソースを採用し、Policyの`backend-id`で参照する。必要性が生じた時点で設計変更する。 |

Backendリソースを既に運用している場合は、`serviceUrl`への切り替えを目的とした無用な変更はしない。**接続先URLの管理元を環境パラメーターに一本化する**ことが重要である。〔13〕

環境構成はDEV / UAT / PROD / DRで別々のAPIMインスタンスを持つ前提。API識別子、Operation識別子、Policy本文は原則共通とし、APIM名・Backend URL・認証テナント・audience・必要なKey Vault参照等を`booking.bicepparam`で切り替える。秘密値をGitに保存しない。Subscription Key要否とEntra ID認証の要否は別の設計項目として扱う。

## 6. CI/CDによる反映

既存のAzure Pipelinesと承認・ブランチ運用を使用する。APIM用の独立したデプロイ入口・Pipeline・環境パラメーターは設けない。

1. **変更：** アプリ担当者がOpenAPI・Policyを変更する。API/Operationの追加、削除、識別子変更の場合は基盤担当者が`booking.bicep`の登録も確認する。
2. **PR検証：** Bicepのbuild/lint、OpenAPIの構文・仕様、Policy XML構文、`operationId`の整合性を検証する。認証・認可に関わるPolicyは基盤担当者が必須レビューする。
3. **成果物：** 承認されたコミットから共通のARMテンプレートと環境別パラメーターを成果物化し、同一コミットに基づく成果物を環境間で昇格する。
4. **展開：** 各環境で`what-if`を確認後、既存の承認・排他制御に従って`booking.bicep`を増分デプロイする。
5. **確認：** DEVでAPIインポート・Policy適用を確認し、UATでは認証・認可拒否、既存Operation、バックエンド疎通を含む回帰確認を実施する。PROD/DRへの反映は既存の運用に従う。

**統合デプロイの注意点：** Policy変更だけでも`booking.bicep`が管理する基盤・全APIのリソース定義がデプロイ対象となる。変更していないAPIやAPIM本体について「必ず無操作になる」とは断定しない。宣言済みリソースではプロパティが再適用されるため、事前の`what-if`とDEVでの実検証が必要である。**少なくとも「Policyだけを変更した場合に、他APIのOperationや設定へ予期しない影響がないか」を確認する。**〔14、15〕

また、`what-if`はOpenAPIインポートに伴うOperation削除やゲートウェイ上の実際のPolicy動作を完全に検証できない。テストで補完する。閉域APIMへ到達させる必要がある場合は既存の到達可能なAgentを利用する。〔15〕

## 7. 運用上の注意点

### 7.1 OpenAPI更新とOperation

APIMはOpenAPI更新時に`operationId`を既存Operationのリソース名と照合する。対応しない既存Operationは削除される場合がある。`operationId`はすべてのOperationで明示し、初回公開後は原則変更しない。OpenAPIのOperationとOperation Policyのディレクトリ名・Bicep登録値を一致させる。〔7〕

APIを新規追加・削除する場合とOperationを削除する場合は、PRで利用者への影響と復旧方法を確認する。**ARMの増分モードでテンプレートから削除したリソースが自動削除されないこと**と、**APIMのOpenAPI再インポートでOperationが削除され得ること**は区別する。〔7、14〕

### 7.2 Policy継承と認証・認可

APIまたはOperationのPolicyを定義する場合は、原則として`<base />`で上位スコープのPolicyを継承する。共通認証をGlobal Policyに置く場合も、下位Policyに継承漏れがないか確認する。OpenAPIの`security`記述だけでAPIMの認証・認可が実装されるわけではない。〔16〕

```xml
<policies>
  <inbound><base /></inbound>
  <backend><base /></backend>
  <outbound><base /></outbound>
  <on-error><base /></on-error>
</policies>
```

このXMLは継承の例であり、認証を実装するものではない。Entra ID認証を使用する場合は適切なトークン検証Policyを設定し、必要なロール／スコープ等の認可条件を検証する。認証・認可が必須のAPIについて、Policy適用に失敗した状態で公開しない。〔17〕

### 7.3 GitとPortal、削除・復旧

Gitを正とし、通常の変更はPR・Pipeline経由とする。Portalで緊急変更した場合も、次回のデプロイ前にGitへ反映して差分を解消する。GitからPolicyやAPI登録を削除しただけでは既存のAPIMリソースが残り得るため、明示的な削除手順で対応する。不要リソース削除を目的としてテンプレート全体を完全モードにしない。〔14〕

ARMデプロイは原子的な更新ではない。途中失敗後は実際のAPI・Operation・Policyの状態を確認してから復旧する。基本は**前の承認済み成果物＋対象環境のパラメーターによる再展開**とし、デプロイ前の状態に完全復元されるとは考えない。追加したAPIやPolicyの明示削除が必要になる場合もある。API Revisionによる段階公開・自動ロールバックは今回の要件外とする。

## 8. 実装前に確認する項目

設計変更のための追加ヒアリングではなく、**DEVでの実装・動作検証項目**として扱う。

| 優先度 | 確認項目 | 合格条件 |
| --- | --- | --- |
| 必須 | `booking.bicep`内のAPIM本体・APIの依存関係 | 初回展開時にAPI登録がAPIM本体より先行しない。 |
| 必須 | Policyだけの変更で統合デプロイ | 非変更APIのOperation・Policy・APIM基盤設定に予期しない変更がない。 |
| 必須 | API Policyを省略したAPI | API登録に成功し、想定した上位Policy・認証が適用される。 |
| 必須 | OpenAPI変更・Operationの追加／削除 | `operationId`とOperation Policyの対応、および削除時の影響が確認できる。 |
| 必須 | 新規APIの認証Policy適用失敗 | 意図せず未認証のAPIが公開状態にならない。 |
| 必須 | `booking.bicepparam`の環境切り替え | APIM名・接続先・認証値が各環境で正しく切り替わる。 |
| 必須 | 既存Azure Pipelinesの承認・排他 | 統合後もPROD承認迂回や並列更新が発生しない。 |
| 必要時 | Backendリソース・Global Policy・Fragment | 採用するAPIでのみ正しい依存関係と適用先を確認する。 |

**未確認事項：** 実際の`booking.bicep`とAPIMモジュールの既存実装、APIMインスタンスごとの管理範囲、API数／OpenAPIのサイズ、既存Backend設定の有無は提示されていない。したがって本書のBicep断片は未コンパイル・未デプロイであり、ファイル名・依存関係・パラメーターは実装時に既存定義と突き合わせる。

## 9. 参考資料

原設計書に掲載されたMicrosoft一次資料のうち、今回の判断に直接関係するものを継続参照する。

| 番号 | 資料 | URL |
| --- | --- | --- |
| 1 | APIM本体のBicep Quickstart | https://github.com/Azure/azure-quickstart-templates/blob/master/quickstarts/microsoft.apimanagement/azure-api-management-create/main.bicep |
| 2 | APIM API・PolicyのARMサンプル | https://github.com/Azure/azure-quickstart-templates/blob/master/quickstarts/microsoft.apimanagement/api-management-create-all-resources/azuredeploy.json |
| 3 | APIOps CLI Artifact形式 | https://github.com/Azure/apiops-cli/blob/fb157dec09012d8161214b3f4998d04f68c96cd2/docs/reference/artifact-format.md |
| 4 | APIOps CLI | https://github.com/Azure/apiops-cli |
| 5 | 旧Azure APIOps | https://github.com/Azure/apiops |
| 6 | Bicepファイル関数 | https://learn.microsoft.com/ja-jp/azure/azure-resource-manager/bicep/bicep-functions-files |
| 7 | APIM OpenAPIインポート・Operation更新制限 | https://learn.microsoft.com/ja-jp/azure/api-management/api-management-api-import-restrictions |
| 8 | APIM APIリソース | https://learn.microsoft.com/ja-jp/azure/templates/microsoft.apimanagement/2024-05-01/service/apis |
| 9 | API Policyリソース | https://learn.microsoft.com/ja-jp/azure/templates/microsoft.apimanagement/2024-05-01/service/apis/policies |
| 10 | Bicep条件付きデプロイ | https://learn.microsoft.com/ja-jp/azure/azure-resource-manager/bicep/conditional-resource-deployment |
| 11 | Bicepモジュールと依存関係 | https://learn.microsoft.com/ja-jp/azure/azure-resource-manager/bicep/resource-dependencies |
| 12 | ARMのテンプレート制限 | https://learn.microsoft.com/ja-jp/azure/azure-resource-manager/management/azure-subscription-service-limits#template-limits |
| 13 | APIM Backendの設定 | https://learn.microsoft.com/ja-jp/azure/api-management/backends |
| 14 | ARM増分デプロイの挙動 | https://learn.microsoft.com/ja-jp/azure/azure-resource-manager/templates/deployment-modes |
| 15 | what-ifの注意点 | https://learn.microsoft.com/ja-jp/azure/azure-resource-manager/bicep/deploy-what-if |
| 16 | APIM Policyの継承 | https://learn.microsoft.com/ja-jp/azure/api-management/api-management-howto-policies |
| 17 | Entraトークン検証Policy | https://learn.microsoft.com/ja-jp/azure/api-management/validate-azure-ad-token-policy |
| 18 | Operation Policyリソース | https://learn.microsoft.com/ja-jp/azure/templates/microsoft.apimanagement/2024-05-01/service/apis/operations/policies |
| 19 | Azure Pipelines承認・排他 | https://learn.microsoft.com/ja-jp/azure/devops/pipelines/process/approvals?view=azure-devops |
