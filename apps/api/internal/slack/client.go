package slack

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
)

type Channel struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type Client struct {
	token string
}

func NewClient(token string) *Client {
	return &Client{token: token}
}

func (c *Client) ListChannels(ctx context.Context) ([]Channel, error) {
	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodGet,
		"https://slack.com/api/conversations.list?types=public_channel,private_channel",
		nil,
	)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Authorization", "Bearer "+c.token)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result struct {
		Ok       bool      `json:"ok"`
		Error    string    `json:"error"`
		Channels []Channel `json:"channels"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	if !result.Ok {
		return nil, fmt.Errorf("slack api error: %s", result.Error)
	}

	return result.Channels, nil
}

func PostMessage(ctx context.Context, token, channelID, text string, blocks interface{}) error {
	payload := map[string]interface{}{
		"channel": channelID,
		"text":    text,
	}
	if blocks != nil {
		payload["blocks"] = blocks
	}

	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://slack.com/api/chat.postMessage", bytes.NewReader(data))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json; charset=utf-8")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	var result struct {
		Ok    bool   `json:"ok"`
		Error string `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return err
	}
	if !result.Ok {
		return fmt.Errorf("slack chat.postMessage error: %s", result.Error)
	}
	return nil
}
