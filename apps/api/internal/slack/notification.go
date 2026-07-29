package slack

import (
	"fmt"
)

// BuildSlackMessage returns a formatted Slack text and a set of Block Kit blocks
// describing an issue event.
func BuildSlackMessage(issueRef, title, actor, action, link string) (string, interface{}) {
	text := fmt.Sprintf("[%s] %s %s by %s", issueRef, title, action, actor)
	blocks := []map[string]interface{}{
		{
			"type": "section",
			"text": map[string]interface{}{
				"type": "mrkdwn",
				"text": fmt.Sprintf("*<%s|[%s] %s>* \n%s by %s", link, issueRef, title, action, actor),
			},
		},
	}
	return text, blocks
}
