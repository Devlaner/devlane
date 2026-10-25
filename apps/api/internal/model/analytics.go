package model

type StateCount struct {
	State string `gorm:"column:state" json:"state"`
	Count int64  `gorm:"column:count" json:"count"`
}

type PriorityCount struct {
	Priority string `gorm:"column:priority" json:"priority"`
	Count    int64  `gorm:"column:count" json:"count"`
}

type AssigneeCount struct {
	Email string `gorm:"column:email" json:"email"`
	Count int64  `gorm:"column:count" json:"count"`
}

type LabelCount struct {
	Label string `gorm:"column:label" json:"label"`
	Count int64  `gorm:"column:count" json:"count"`
}

type WorkspaceIssueExport struct {
	ID       string `json:"id" gorm:"column:id"`
	Name     string `json:"name" gorm:"column:name"`
	State    string `json:"state" gorm:"column:state"`
	Priority string `json:"priority" gorm:"column:priority"`
	Assignee string `json:"assignee" gorm:"column:assignee"`
	Labels   string `json:"labels" gorm:"column:labels"`
}

type ProjectIssueExport struct {
	ID       string `json:"id" gorm:"column:id"`
	Name     string `json:"name" gorm:"column:name"`
	State    string `json:"state" gorm:"column:state"`
	Priority string `json:"priority" gorm:"column:priority"`
	Assignee string `json:"assignee" gorm:"column:assignee"`
	Labels   string `json:"labels" gorm:"column:labels"`
}

type TrendPoint struct {
	Date     string `gorm:"column:date" json:"date"`
	Created  int64  `gorm:"column:created" json:"created"`
	Resolved int64  `gorm:"column:resolved" json:"resolved"`
}
