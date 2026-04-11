#!/bin/bash
# ChatGPT ↔ Claude Desktop 自動リレースクリプト
# ChatGPT(監督) → Claude Desktop(作業者) を自動で往復させる

set -euo pipefail

POLL_INTERVAL=3        # ポーリング間隔（秒）
STABLE_THRESHOLD=10    # テキストが安定してから完了と判定するまでの秒数
RELOAD_WAIT=4          # ChatGPTリロード後の待機秒数
MAX_WAIT=600           # 最大待機秒数（10分）

log() {
    echo "[$(date '+%H:%M:%S')] $1"
}

# ─── ChatGPTアプリから最新メッセージを取得 ─────────────────
read_chatgpt_latest() {
    osascript -e '
    tell application "System Events"
        tell process "ChatGPT"
            set msgList to every group of list 1 of list 1 of scroll area 1 of group 1 of splitter group 1 of group 1 of window 1
            set msgCount to count of msgList
            set lastGroup to item msgCount of msgList
            set allElems to entire contents of lastGroup
            set output to ""
            repeat with elem in allElems
                try
                    set c to class of elem as string
                    if c is "static text" then
                        set d to description of elem
                        if d is not missing value and d is not "" then
                            if length of output > 0 then
                                set output to output & return
                            end if
                            set output to output & d
                        end if
                    end if
                end try
            end repeat
            return output
        end tell
    end tell
    ' 2>/dev/null
}

# ─── ChatGPTのメッセージ数を取得 ─────────────────
get_chatgpt_msg_count() {
    osascript -e '
    tell application "System Events"
        tell process "ChatGPT"
            set msgList to every group of list 1 of list 1 of scroll area 1 of group 1 of splitter group 1 of group 1 of window 1
            return count of msgList
        end tell
    end tell
    ' 2>/dev/null
}

# ─── ChatGPTアプリをリロード ─────────────────
reload_chatgpt() {
    log "ChatGPT リロード中..."
    osascript -e '
    tell application "ChatGPT" to activate
    delay 0.3
    tell application "System Events"
        tell process "ChatGPT"
            click menu item "再読み込み" of menu 1 of menu bar item "表示" of menu bar 1
        end tell
    end tell
    ' 2>/dev/null
    sleep "$RELOAD_WAIT"
    log "ChatGPT リロード完了"
}

# ─── ChatGPTアプリにメッセージ送信 ─────────────────
send_to_chatgpt() {
    local msg="$1"
    log "ChatGPTに送信中... (${#msg} 文字)"
    echo -n "$msg" | pbcopy
    osascript -e '
    tell application "ChatGPT" to activate
    delay 0.3
    tell application "System Events"
        tell process "ChatGPT"
            click text area 1 of scroll area 2 of group 1 of splitter group 1 of group 1 of window 1
            delay 0.2
            keystroke "v" using command down
            delay 0.3
            keystroke return
        end tell
    end tell
    ' 2>/dev/null
    log "ChatGPTに送信完了"
}

# ─── ChatGPTの応答完了を待機 ─────────────────
wait_chatgpt_response() {
    local before_count="$1"
    local waited=0
    local stable_count=0
    local last_text=""

    log "ChatGPT応答待ち..."
    sleep 5

    while [ $waited -lt $MAX_WAIT ]; do
        local current_count
        current_count=$(get_chatgpt_msg_count 2>/dev/null || echo "0")

        if [ "$current_count" -gt "$before_count" ]; then
            local current_text
            current_text=$(read_chatgpt_latest 2>/dev/null || echo "")

            if [ "$current_text" = "$last_text" ] && [ -n "$current_text" ]; then
                stable_count=$((stable_count + POLL_INTERVAL))
                if [ $stable_count -ge $STABLE_THRESHOLD ]; then
                    log "ChatGPT応答完了 (${#current_text} 文字)"
                    return 0
                fi
            else
                stable_count=0
                last_text="$current_text"
            fi
        fi

        sleep $POLL_INTERVAL
        waited=$((waited + POLL_INTERVAL))
    done
    log "WARNING: ChatGPT応答タイムアウト ($MAX_WAIT秒)"
    return 1
}

# ─── Claudeアプリの全テキストを取得 ─────────────────
read_claude_all() {
    osascript -e '
    tell application "Claude" to activate
    delay 0.3
    tell application "System Events"
        tell process "Claude"
            keystroke "a" using command down
            delay 0.3
            keystroke "c" using command down
            delay 0.3
        end tell
    end tell
    ' 2>/dev/null
    sleep 0.5
    pbpaste 2>/dev/null
}

# ─── Claudeアプリにメッセージ送信 ─────────────────
send_to_claude() {
    local msg="$1"
    log "Claudeに送信中... (${#msg} 文字)"
    echo -n "$msg" | pbcopy
    osascript -e '
    tell application "Claude" to activate
    delay 0.3
    tell application "System Events"
        tell process "Claude"
            key code 53
            delay 0.2
            keystroke "v" using command down
            delay 0.3
            keystroke return
        end tell
    end tell
    ' 2>/dev/null
    log "Claudeに送信完了"
}

# ─── Claudeの応答完了を待機 ─────────────────
wait_claude_response() {
    local before_len="$1"
    local waited=0
    local stable_count=0
    local last_len=0

    log "Claude応答待ち..."
    sleep 5

    while [ $waited -lt $MAX_WAIT ]; do
        local current_text
        current_text=$(read_claude_all 2>/dev/null || echo "")
        local current_len=${#current_text}

        if [ $current_len -gt $before_len ]; then
            if [ $current_len -eq $last_len ]; then
                stable_count=$((stable_count + POLL_INTERVAL))
                if [ $stable_count -ge $STABLE_THRESHOLD ]; then
                    log "Claude応答完了 ($current_len 文字)"
                    return 0
                fi
            else
                stable_count=0
                last_len=$current_len
            fi
        fi

        sleep $POLL_INTERVAL
        waited=$((waited + POLL_INTERVAL))
    done
    log "WARNING: Claude応答タイムアウト ($MAX_WAIT秒)"
    return 1
}

# ─── Claudeの最新レスポンスを抽出 ─────────────────
extract_claude_latest() {
    local full_text="$1"
    local sent_msg="$2"

    local marker
    marker=$(echo "$sent_msg" | head -c 60)

    # マーカー以降、重複行除去して取得
    echo "$full_text" | awk -v marker="$marker" '
    BEGIN { found=0; output="" }
    {
        if (index($0, marker) > 0) {
            found=1
            output=""
            next
        }
        if (found) {
            if ($0 != prev || $0 == "") {
                if (length(output) > 0) output = output "\n"
                output = output $0
            }
            prev = $0
        }
    }
    END { print output }
    '
}

# ─── メインループ ─────────────────
main() {
    log "===== ChatGPT ↔ Claude 自動リレー開始 ====="
    log "Ctrl+C で停止"
    echo ""

    local cycle=0

    while true; do
        cycle=$((cycle + 1))
        log "===== サイクル $cycle ====="

        # Step 1: ChatGPTリロード → 最新メッセージ取得
        reload_chatgpt
        sleep 2
        local chatgpt_msg
        chatgpt_msg=$(read_chatgpt_latest)

        if [ -z "$chatgpt_msg" ]; then
            log "ERROR: ChatGPTメッセージ取得失敗。5秒後リトライ..."
            sleep 5
            continue
        fi

        log "ChatGPT最新 (${#chatgpt_msg} 文字): $(echo "$chatgpt_msg" | head -c 80)..."

        # Step 2: Claudeの現在テキスト長を保存
        local claude_before
        claude_before=$(read_claude_all)
        local claude_before_len=${#claude_before}

        # Step 3: ChatGPTメッセージをClaudeに送信
        send_to_claude "$chatgpt_msg"

        # Step 4: Claude応答完了待ち
        wait_claude_response "$claude_before_len"

        # Step 5: Claude最新レスポンス抽出
        local claude_after
        claude_after=$(read_claude_all)
        local claude_response
        claude_response=$(extract_claude_latest "$claude_after" "$chatgpt_msg")

        if [ -z "$claude_response" ]; then
            log "WARNING: 応答抽出失敗。差分テキスト使用"
            claude_response="${claude_after:$claude_before_len}"
        fi

        log "Claude応答 (${#claude_response} 文字): $(echo "$claude_response" | head -c 80)..."

        # Step 6: ChatGPTリロード
        reload_chatgpt

        # Step 7: メッセージ数記録
        local msg_count_before
        msg_count_before=$(get_chatgpt_msg_count)

        # Step 8: Claude応答をChatGPTに送信
        send_to_chatgpt "$claude_response"

        # Step 9: ChatGPT応答完了待ち
        wait_chatgpt_response "$msg_count_before"

        log "サイクル $cycle 完了"
        echo ""
    done
}

main "$@"
