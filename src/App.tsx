import { useState, useEffect } from 'react'
import questionsData from './data/questions.json'

// 型定義
interface Question {
  id: number
  category: string
  question: string
  code: string
  options: string[]
  answerIndex: number
  explanation: string
}

interface AnswerHistory {
  questionId: number
  category: string
  isCorrect: boolean
  timestamp: number
}

function App() {
  // 画面遷移状態 ('home' | 'quiz' | 'result')
  const [screen, setScreen] = useState<'home' | 'quiz' | 'result'>('home')
  
  // 出題設定
  const [quizMode, setQuizMode] = useState<'all' | 'random10' | 'category'>('all')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  
  // クイズ実行状態
  const [currentQuestions, setCurrentQuestions] = useState<Question[]>([])
  const [currentIndex, setCurrentIndex] = useState<number>(0)
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [isAnswered, setIsAnswered] = useState<boolean>(false)
  
  // 今回のセッションの解答結果
  const [sessionResults, setSessionResults] = useState<{ questionId: number, isCorrect: boolean, selectedIndex: number }[]>([])
  
  // 永続化された学習履歴（LocalStorage）
  const [globalHistory, setGlobalHistory] = useState<AnswerHistory[]>([])

  // 全カテゴリの抽出
  const categories = Array.from(new Set(questionsData.map(q => q.category)))

  // 初回読み込み時に履歴をロード
  useEffect(() => {
    const saved = localStorage.getItem('java-bronze-dojo-history')
    if (saved) {
      try {
        setGlobalHistory(JSON.parse(saved))
      } catch (e) {
        console.error('Failed to load history', e)
      }
    }
  }, [])

  // 履歴の保存
  const saveHistory = (newHistory: AnswerHistory[]) => {
    setGlobalHistory(newHistory)
    localStorage.setItem('java-bronze-dojo-history', JSON.stringify(newHistory))
  }

  // 履歴クリア
  const clearHistory = () => {
    if (window.confirm('これまでの学習履歴をすべて消去しますか？（この操作は取り消せません）')) {
      saveHistory([])
    }
  }

  // 履歴のJSONエクスポート
  const exportHistory = () => {
    const dataStr = JSON.stringify(globalHistory, null, 2)
    const blob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `java-bronze-dojo-history-${new Date().toISOString().split('T')[0]}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  // 履歴のJSONインポート
  const importHistory = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader()
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], "UTF-8")
      fileReader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string)
          if (Array.isArray(parsed)) {
            saveHistory(parsed)
            alert('学習履歴を正常にインポートしました！')
          } else {
            alert('無効なファイル形式です。')
          }
        } catch (err) {
          alert('ファイルの読み込み中にエラーが発生しました。')
        }
      }
    }
  }

  // クイズの開始処理
  const startQuiz = () => {
    let questionsToUse: Question[] = [...questionsData]

    // モード別のフィルタリング・シャッフル
    if (quizMode === 'category' && selectedCategory) {
      questionsToUse = questionsToUse.filter(q => q.category === selectedCategory)
    }

    if (quizMode === 'random10') {
      // シャッフルして10問抽出
      questionsToUse = questionsToUse.sort(() => Math.random() - 0.5).slice(0, 10)
    } else {
      // 通常時も問題順をシャッフル
      questionsToUse = questionsToUse.sort(() => Math.random() - 0.5)
    }

    if (questionsToUse.length === 0) {
      alert('該当する問題がありません。')
      return
    }

    setCurrentQuestions(questionsToUse)
    setCurrentIndex(0)
    setSelectedOption(null)
    setIsAnswered(false)
    setSessionResults([])
    setScreen('quiz')
  }

  // クイズ中断処理
  const handleQuitQuiz = () => {
    if (window.confirm('演習を中断してホームに戻りますか？（現在の進捗は保存されません）')) {
      setScreen('home')
    }
  }

  // 解答確認ボタン押下
  const handleCheckAnswer = () => {
    if (selectedOption === null) return

    const currentQuestion = currentQuestions[currentIndex]
    const isCorrect = selectedOption === currentQuestion.answerIndex

    // セッション結果に追加
    setSessionResults(prev => [...prev, {
      questionId: currentQuestion.id,
      isCorrect,
      selectedIndex: selectedOption
    }])

    // 永続履歴に追加
    const newRecord: AnswerHistory = {
      questionId: currentQuestion.id,
      category: currentQuestion.category,
      isCorrect,
      timestamp: Date.now()
    }
    saveHistory([newRecord, ...globalHistory])

    setIsAnswered(true)
  }

  // 次の問題（または結果）へ進む
  const handleNext = () => {
    if (currentIndex + 1 < currentQuestions.length) {
      setCurrentIndex(prev => prev + 1)
      setSelectedOption(null)
      setIsAnswered(false)
    } else {
      setScreen('result')
    }
  }

  // ダッシュボード用の統計計算
  const totalAnswers = globalHistory.length
  const correctAnswers = globalHistory.filter(h => h.isCorrect).length
  const totalAccuracy = totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0

  // 分野別正解率の計算
  const categoryStats = categories.map(cat => {
    const catAnswers = globalHistory.filter(h => h.category === cat)
    const catTotal = catAnswers.length
    const catCorrect = catAnswers.filter(h => h.isCorrect).length
    const catAccuracy = catTotal > 0 ? Math.round((catCorrect / catTotal) * 100) : 0
    return { name: cat, total: catTotal, accuracy: catAccuracy }
  })

  // クイズ画面で表示する現在の問題
  const currentQuestion = currentQuestions[currentIndex]

  return (
    <main className="app-card">
      <h1>Java Bronze 過去問道場</h1>

      {/* 1. ホーム画面 */}
      {screen === 'home' && (
        <section className="home-screen">
          <h2 style={{ textAlign: 'center', marginBottom: '24px' }}>学習ダッシュボード</h2>
          
          <div className="grid-stats">
            <div className="stat-box">
              <div className="stat-value">{totalAnswers}</div>
              <div className="stat-label">総解答数</div>
            </div>
            <div className="stat-box">
              <div className="stat-value">{totalAccuracy}%</div>
              <div className="stat-label">総合正解率</div>
            </div>
            <div className="stat-box">
              <div className="stat-value">{correctAnswers}</div>
              <div className="stat-label">正解問題数</div>
            </div>
          </div>

          {totalAnswers > 0 && (
            <div style={{ marginBottom: '32px' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '12px' }}>分野別学習状況</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {categoryStats.map(stat => (
                  <div key={stat.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-primary)', padding: '10px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: '600' }}>{stat.name}</span>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      {stat.total}回演習 (正解率 {stat.accuracy}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '24px', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', textAlign: 'center' }}>出題モード選択</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px', marginBottom: '20px' }}>
              <label className={`option-item ${quizMode === 'all' ? 'selected' : ''}`}>
                <input 
                  type="radio" 
                  name="quizMode" 
                  checked={quizMode === 'all'} 
                  onChange={() => setQuizMode('all')}
                  style={{ display: 'none' }}
                />
                <div className="option-text">
                  <strong>全問題からシャッフル出題</strong>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    登録されているすべての問題からランダムに出題します。
                  </div>
                </div>
              </label>

              <label className={`option-item ${quizMode === 'random10' ? 'selected' : ''}`}>
                <input 
                  type="radio" 
                  name="quizMode" 
                  checked={quizMode === 'random10'} 
                  onChange={() => setQuizMode('random10')}
                  style={{ display: 'none' }}
                />
                <div className="option-text">
                  <strong>模擬演習 (ランダム10問)</strong>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    全問題から10問をピックアップして模擬試験を行います。
                  </div>
                </div>
              </label>

              <label className={`option-item ${quizMode === 'category' ? 'selected' : ''}`}>
                <input 
                  type="radio" 
                  name="quizMode" 
                  checked={quizMode === 'category'} 
                  onChange={() => setQuizMode('category')}
                  style={{ display: 'none' }}
                />
                <div className="option-text">
                  <strong>分野別に出題</strong>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    特定の試験分野に絞って集中演習を行います。
                  </div>
                </div>
              </label>
            </div>

            {quizMode === 'category' && (
              <div style={{ marginBottom: '24px', animation: 'slideIn 0.2s ease-out' }}>
                <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '700', marginBottom: '8px' }}>分野を選択してください</label>
                <select 
                  value={selectedCategory} 
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: 'var(--radius-md)', border: '2px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '1rem', outline: 'none' }}
                >
                  <option value="">-- 分野を選択 --</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            )}

            <button 
              className="btn btn-primary" 
              style={{ width: '100%', padding: '16px' }}
              onClick={startQuiz}
              disabled={quizMode === 'category' && !selectedCategory}
            >
              演習を開始する
            </button>
          </div>

          {/* データ管理エリア */}
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '24px', display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center' }}>
            <button className="btn btn-secondary" onClick={exportHistory} disabled={totalAnswers === 0}>
              履歴を保存 (エクスポート)
            </button>
            <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
              履歴を復元 (インポート)
              <input type="file" accept=".json" onChange={importHistory} style={{ display: 'none' }} />
            </label>
            <button className="btn btn-secondary" style={{ color: 'var(--color-error)' }} onClick={clearHistory} disabled={totalAnswers === 0}>
              学習履歴を初期化
            </button>
          </div>
        </section>
      )}

      {/* 2. クイズ画面 */}
      {screen === 'quiz' && currentQuestion && (
        <section className="quiz-screen">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="badge">{currentQuestion.category}</span>
              <button 
                onClick={handleQuitQuiz}
                style={{ 
                  padding: '4px 8px', 
                  fontSize: '0.75rem', 
                  background: 'transparent', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--color-error)',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                中断
              </button>
            </div>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '600' }}>
              問題 {currentIndex + 1} / {currentQuestions.length}
            </span>
          </div>

          <div className="progress-bar-container">
            <div 
              className="progress-bar" 
              style={{ width: `${((currentIndex + 1) / currentQuestions.length) * 100}%` }}
            ></div>
          </div>

          <div className="question-text">
            {currentQuestion.question}
          </div>

          {/* Javaコードの表示（ある場合のみ） */}
          {currentQuestion.code && (
            <pre className="code-block">
              <code>{currentQuestion.code}</code>
            </pre>
          )}

          {/* 選択肢リスト */}
          <div className="options-list">
            {currentQuestion.options.map((option, idx) => {
              // スタイル決定用のフラグ
              let optionClass = ''
              if (isAnswered) {
                if (idx === currentQuestion.answerIndex) {
                  optionClass = 'correct'
                } else if (idx === selectedOption) {
                  optionClass = 'incorrect'
                } else {
                  optionClass = 'disabled'
                }
              } else if (selectedOption === idx) {
                optionClass = 'selected'
              }

              return (
                <button
                  key={idx}
                  className={`option-item ${optionClass}`}
                  onClick={() => !isAnswered && setSelectedOption(idx)}
                  disabled={isAnswered}
                >
                  <span className="option-number">
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span className="option-text">{option}</span>
                </button>
              )
            })}
          </div>

          {/* 操作ボタン */}
          {!isAnswered ? (
            <button
              className="btn btn-primary"
              style={{ width: '100%', padding: '14px' }}
              disabled={selectedOption === null}
              onClick={handleCheckAnswer}
            >
              解答を確認する
            </button>
          ) : (
            <button
              className="btn btn-primary"
              style={{ width: '100%', padding: '14px' }}
              onClick={handleNext}
            >
              {currentIndex + 1 === currentQuestions.length ? '結果を表示する' : '次の問題へ'}
            </button>
          )}

          {/* 解説表示 */}
          {isAnswered && (
            <div className={`explanation-card ${selectedOption === currentQuestion.answerIndex ? 'correct' : 'incorrect'}`}>
              <div className={`explanation-title ${selectedOption === currentQuestion.answerIndex ? 'correct' : 'incorrect'}`}>
                {selectedOption === currentQuestion.answerIndex ? (
                  <>
                    <span style={{ fontSize: '1.3rem' }}>✓</span> 正解です！
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: '1.3rem' }}>✗</span> 不正解です（正解は {String.fromCharCode(65 + currentQuestion.answerIndex)}）
                  </>
                )}
              </div>
              <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', margin: 0 }}>
                {currentQuestion.explanation}
              </p>
            </div>
          )}
        </section>
      )}

      {/* 3. 結果画面 */}
      {screen === 'result' && (
        <section className="result-screen">
          <h2 style={{ textAlign: 'center', marginBottom: '12px' }}>演習結果</h2>
          
          <div className="stat-box" style={{ maxWidth: '300px', margin: '0 auto 32px auto' }}>
            <div className="stat-value" style={{ fontSize: '2.5rem' }}>
              {sessionResults.filter(r => r.isCorrect).length} / {currentQuestions.length}
            </div>
            <div className="stat-label">正解数 / 出題数</div>
            <div style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--color-primary)', marginTop: '8px' }}>
              正解率: {Math.round((sessionResults.filter(r => r.isCorrect).length / currentQuestions.length) * 100)}%
            </div>
          </div>

          <h3 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>今回の解答履歴</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
            {currentQuestions.map((q, idx) => {
              const result = sessionResults.find(r => r.questionId === q.id)
              const isCorrect = result?.isCorrect ?? false
              return (
                <div 
                  key={q.id} 
                  style={{ 
                    border: '1px solid var(--border-color)', 
                    borderRadius: 'var(--radius-md)', 
                    padding: '16px', 
                    background: 'var(--bg-secondary)',
                    borderLeft: `5px solid ${isCorrect ? 'var(--color-success)' : 'var(--color-error)'}`
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span className="badge">{q.category}</span>
                    <span style={{ fontWeight: '700', color: isCorrect ? 'var(--color-success)' : 'var(--color-error)', fontSize: '0.9rem' }}>
                      {isCorrect ? '正解 ✓' : '不正解 ✗'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.95rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '8px' }}>
                    問{idx + 1}: {q.question}
                  </div>
                  <div style={{ background: 'var(--bg-primary)', padding: '12px', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <strong>解説:</strong> {q.explanation}
                  </div>
                </div>
              )
            })}
          </div>

          <button 
            className="btn btn-primary" 
            style={{ width: '100%', padding: '16px' }}
            onClick={() => setScreen('home')}
          >
            ダッシュボードに戻る
          </button>
        </section>
      )}
    </main>
  )
}

export default App
