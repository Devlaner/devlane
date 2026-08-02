package slack

import (
	"fmt"
	"strings"
)

// escapeMrkdwn escapes Slack's restricted mrkdwn characters
func escapeMrkdwn(s string) string {
	return strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;").Replace(s)
}

// BuildSlackMessage returns a formatted Slack text and a set of Block Kit blocks
// describing an issue event.
func BuildSlackMessage(issueRef, title, actor, action, link string) (string, interface{}) {
	escRef := escapeMrkdwn(issueRef)
	escTitle := escapeMrkdwn(title)
	escActor := escapeMrkdwn(actor)
	escAction := escapeMrkdwn(action)

	text := fmt.Sprintf("[%s] %s %s by %s", escRef, escTitle, escAction, escActor)
	blocks := []map[string]interface{}{
		{
			"type": "section",
			"text": map[string]interface{}{
				"type": "mrkdwn",
				"text": fmt.Sprintf("*<%s|[%s] %s>* \n%s by %s", link, escRef, escTitle, escAction, escActor),
			},
		},
	}
	return text, blocks
}
