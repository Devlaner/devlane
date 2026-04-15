package router

import (
	"log/slog"

	"github.com/Devlaner/devlane/api/internal/auth"
	"github.com/Devlaner/devlane/api/internal/handler"
	"github.com/Devlaner/devlane/api/internal/middleware"
	"github.com/Devlaner/devlane/api/internal/minio"
	"github.com/Devlaner/devlane/api/internal/queue"
	"github.com/Devlaner/devlane/api/internal/redis"
	"github.com/Devlaner/devlane/api/internal/service"
	"github.com/Devlaner/devlane/api/internal/store"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// Config holds dependencies for the router.
type Config struct {
	Log               *slog.Logger
	DB                *gorm.DB
	Redis             *redis.Client    // optional: cache, locks, magic-link
	Queue             *queue.Publisher // optional: enqueue emails, webhooks
	Minio             *minio.Client    // optional: file uploads (cover images, avatars, logos)
	CORSAllowOrigin   string           // optional: e.g. "http://localhost:5173" for UI dev
	AppBaseURL        string           // optional: base URL for invite links; if empty, CORSAllowOrigin is used
	FrontendPublicURL string           // optional: SPA origin for OAuth JS-origin hints; if empty, falls back to AppBaseURL chain
	APIPublicURL      string           // optional: public API URL for OAuth callback generation

	// MagicCodeSecret is the HMAC key for email login codes (see MAGIC_CODE_SECRET).
	MagicCodeSecret string
}

// New builds and returns the Gin engine with /api/ and /auth/ routes.
func New(cfg Config) *gin.Engine {
	if cfg.Log == nil {
		cfg.Log = slog.Default()
	}

	gin.SetMode(gin.ReleaseMode)
	r := gin.New()

	r.Use(middleware.Recovery(cfg.Log))
	r.Use(middleware.Logger(cfg.Log))
	if cfg.CORSAllowOrigin != "" {
		r.Use(middleware.CORS(cfg.CORSAllowOrigin))
	}

	// Health (no auth)
	r.GET("/health", handler.Health)
	r.GET("/ready", handler.Readiness)

	// Stores
	userStore := store.NewUserStore(cfg.DB)
	sessionStore := store.NewSessionStore(cfg.DB)
	workspaceStore := store.NewWorkspaceStore(cfg.DB)
	workspaceInviteStore := store.NewWorkspaceInviteStore(cfg.DB)
	projectStore := store.NewProjectStore(cfg.DB)
	projectInviteStore := store.NewProjectInviteStore(cfg.DB)
	stateStore := store.NewStateStore(cfg.DB)
	labelStore := store.NewLabelStore(cfg.DB)
	issueStore := store.NewIssueStore(cfg.DB)
	cycleStore := store.NewCycleStore(cfg.DB)
	moduleStore := store.NewModuleStore(cfg.DB)
	issueViewStore := store.NewIssueViewStore(cfg.DB)
	pageStore := store.NewPageStore(cfg.DB)
	notificationStore := store.NewNotificationStore(cfg.DB)
	commentStore := store.NewCommentStore(cfg.DB)
	instanceSettingStore := store.NewInstanceSettingStore(cfg.DB)
	workspaceUserLinkStore := store.NewWorkspaceUserLinkStore(cfg.DB)
	stickyStore := store.NewStickyStore(cfg.DB)
	userRecentVisitStore := store.NewUserRecentVisitStore(cfg.DB)
	userNotifPrefStore := store.NewUserNotificationPreferenceStore(cfg.DB)
	apiTokenStore := store.NewApiTokenStore(cfg.DB)
	userFavoriteStore := store.NewUserFavoriteStore(cfg.DB)

	// Password reset tokens
	passwordResetTokenStore := store.NewPasswordResetTokenStore(cfg.DB)
	accountStore := store.NewAccountStore(cfg.DB)

	// Auth
	authSvc := auth.NewService(userStore, sessionStore, passwordResetTokenStore)
	authSvc.SetAccountStore(accountStore)
	appBaseURL := cfg.AppBaseURL
	if appBaseURL == "" {
		appBaseURL = cfg.CORSAllowOrigin
	}

	authHandler := &handler.AuthHandler{
		Auth:              authSvc,
		Settings:          instanceSettingStore,
		Winv:              workspaceInviteStore,
		Ws:                workspaceStore,
		NotifPrefs:        userNotifPrefStore,
		ApiTokens:         apiTokenStore,
		Queue:             cfg.Queue,
		Redis:             cfg.Redis,
		MagicCodeSecret:   cfg.MagicCodeSecret,
		AppBaseURL:        appBaseURL,
		FrontendPublicURL: cfg.FrontendPublicURL,
		APIPublicURL:      cfg.APIPublicURL,
		Log:               cfg.Log,
	}
	// Instance setup (no auth) — first-run flow; seeds general settings (instance_id, admin_email, instance_name)
	instanceHandler := &handler.InstanceHandler{Auth: authSvc, Users: userStore, Settings: instanceSettingStore}
	r.GET("/api/instance/setup-status/", instanceHandler.SetupStatus)
	r.POST("/api/instance/setup/", instanceHandler.InstanceSetup)

	invitationHandler := &handler.InvitationHandler{Winv: workspaceInviteStore, Ws: workspaceStore}
	r.GET("/api/invitations/by-token/", invitationHandler.GetInviteByToken)
	r.POST("/api/invitations/decline/", invitationHandler.DeclineInviteByToken)

	instanceSettingsHandler := &handler.InstanceSettingsHandler{Settings: instanceSettingStore}

	// Services
	workspaceSvc := service.NewWorkspaceService(workspaceStore, workspaceInviteStore, userStore)
	projectSvc := service.NewProjectService(projectStore, projectInviteStore, workspaceStore, userStore)
	stateSvc := service.NewStateService(stateStore, projectStore, workspaceStore)
	labelSvc := service.NewLabelService(labelStore, projectStore, workspaceStore)
	issueSvc := service.NewIssueService(issueStore, projectStore, workspaceStore)
	cycleSvc := service.NewCycleService(cycleStore, projectStore, workspaceStore)
	moduleSvc := service.NewModuleService(moduleStore, projectStore, workspaceStore)
	issueViewSvc := service.NewIssueViewService(issueViewStore, projectStore, workspaceStore, userFavoriteStore)
	pageSvc := service.NewPageService(pageStore, projectStore, workspaceStore)
	notificationSvc := service.NewNotificationService(notificationStore, workspaceStore)
	commentSvc := service.NewCommentService(commentStore, issueStore, projectStore, workspaceStore)
	workspaceLinkSvc := service.NewWorkspaceLinkService(workspaceUserLinkStore, workspaceStore)
	stickySvc := service.NewStickyService(stickyStore, workspaceStore)
	recentVisitSvc := service.NewRecentVisitService(userRecentVisitStore, workspaceStore, issueStore, projectStore, pageStore)

	// Handlers
	workspaceHandler := &handler.WorkspaceHandler{
		Workspace:  workspaceSvc,
		Settings:   instanceSettingStore,
		Queue:      cfg.Queue,
		AppBaseURL: appBaseURL,
	}
	projectHandler := &handler.ProjectHandler{Project: projectSvc}
	favoriteHandler := &handler.FavoriteHandler{Project: projectSvc, Favorites: userFavoriteStore}
	stateHandler := &handler.StateHandler{State: stateSvc}
	labelHandler := &handler.LabelHandler{Label: labelSvc}
	issueHandler := &handler.IssueHandler{Issue: issueSvc}
	cycleHandler := &handler.CycleHandler{Cycle: cycleSvc}
	moduleHandler := &handler.ModuleHandler{Module: moduleSvc}
	issueViewHandler := &handler.IssueViewHandler{IssueView: issueViewSvc}
	pageHandler := &handler.PageHandler{Page: pageSvc}
	notificationHandler := &handler.NotificationHandler{Notification: notificationSvc}
	commentHandler := &handler.CommentHandler{Comment: commentSvc}
	workspaceLinkHandler := &handler.WorkspaceLinkHandler{Link: workspaceLinkSvc}
	stickyHandler := &handler.StickyHandler{Sticky: stickySvc}
	recentVisitHandler := &handler.RecentVisitHandler{Recent: recentVisitSvc}
	userHandler := &handler.UserHandler{Comments: commentStore, Issues: issueStore}

	// Protected API: require auth
	api := r.Group("/api")
	api.Use(middleware.RequireAuth(authSvc, cfg.Log))
	{
		api.GET("/users/me/", authHandler.Me)
		api.PATCH("/users/me/", authHandler.UpdateMe)
		api.POST("/users/me/change-password/", authHandler.ChangePassword)
		api.POST("/users/me/set-password/", authHandler.SetPassword)
		api.GET("/users/me/notification-preferences/", authHandler.GetNotificationPreferences)
		api.PUT("/users/me/notification-preferences/", authHandler.UpdateNotificationPreferences)
		api.GET("/users/me/activity/", userHandler.GetActivity)
		api.GET("/users/me/tokens/", authHandler.ListTokens)
		api.POST("/users/me/tokens/", authHandler.CreateToken)
		api.DELETE("/users/me/tokens/:id/", authHandler.RevokeToken)
		api.GET("/users/me/favorite-projects/", favoriteHandler.ListFavoriteProjects)
		api.GET("/instance/settings/", instanceSettingsHandler.GetSettings)
		api.PATCH("/instance/settings/:key", instanceSettingsHandler.UpdateSetting)
		api.GET("/instance/unsplash/search", instanceSettingsHandler.UnsplashSearch)

		uploadHandler := &handler.UploadHandler{Minio: cfg.Minio}
		api.POST("/upload", uploadHandler.Upload)
		api.GET("/files/*path", uploadHandler.ServeFile)
		api.GET("/users/me/workspaces/", workspaceHandler.List)
		api.GET("/users/me/workspaces/invitations/", workspaceHandler.ListUserInvitations)
		api.GET("/workspace-slug-check/", workspaceHandler.SlugCheck)
		api.POST("/workspaces/", workspaceHandler.Create)
		api.POST("/workspaces/join/", workspaceHandler.JoinByToken)
		api.GET("/workspaces/:slug/", workspaceHandler.GetBySlug)
		api.PATCH("/workspaces/:slug/", workspaceHandler.Update)
		api.DELETE("/workspaces/:slug/", workspaceHandler.Delete)
		api.GET("/workspaces/:slug/members/", workspaceHandler.ListMembers)
		api.POST("/workspaces/:slug/members/leave/", workspaceHandler.Leave)
		api.GET("/workspaces/:slug/members/:pk/", workspaceHandler.GetMember)
		api.PATCH("/workspaces/:slug/members/:pk/", workspaceHandler.UpdateMember)
		api.DELETE("/workspaces/:slug/members/:pk/", workspaceHandler.DeleteMember)
		api.GET("/workspaces/:slug/invitations/", workspaceHandler.ListInvites)
		api.POST("/workspaces/:slug/invitations/", workspaceHandler.CreateInvite)
		api.GET("/workspaces/:slug/invitations/:pk/", workspaceHandler.GetInvite)
		api.DELETE("/workspaces/:slug/invitations/:pk/", workspaceHandler.DeleteInvite)
		api.POST("/workspaces/:slug/invitations/:pk/join/", workspaceHandler.JoinByInvite)

		api.GET("/users/me/workspaces/:slug/projects/invitations/", projectHandler.ListUserProjectInvitations)
		api.POST("/workspaces/:slug/projects/join/", projectHandler.JoinByToken)
		api.GET("/workspaces/:slug/draft-issues/", issueHandler.ListWorkspaceDrafts)

		api.GET("/workspaces/:slug/projects/", projectHandler.List)
		api.POST("/workspaces/:slug/projects/", projectHandler.Create)
		api.GET("/workspaces/:slug/projects/:projectId/", projectHandler.Get)
		api.PATCH("/workspaces/:slug/projects/:projectId/", projectHandler.Update)
		api.DELETE("/workspaces/:slug/projects/:projectId/", projectHandler.Delete)
		api.POST("/workspaces/:slug/projects/:projectId/favorite", favoriteHandler.AddFavoriteProject)
		api.DELETE("/workspaces/:slug/projects/:projectId/favorite", favoriteHandler.RemoveFavoriteProject)
		api.GET("/workspaces/:slug/projects/:projectId/members/", projectHandler.ListMembers)
		api.POST("/workspaces/:slug/projects/:projectId/members/leave/", projectHandler.Leave)
		api.GET("/workspaces/:slug/projects/:projectId/members/:pk/", projectHandler.GetMember)
		api.PATCH("/workspaces/:slug/projects/:projectId/members/:pk/", projectHandler.UpdateMember)
		api.DELETE("/workspaces/:slug/projects/:projectId/members/:pk/", projectHandler.DeleteMember)
		api.GET("/workspaces/:slug/projects/:projectId/invitations/", projectHandler.ListInvites)
		api.POST("/workspaces/:slug/projects/:projectId/invitations/", projectHandler.CreateInvite)
		api.GET("/workspaces/:slug/projects/:projectId/invitations/:pk/", projectHandler.GetInvite)
		api.DELETE("/workspaces/:slug/projects/:projectId/invitations/:pk/", projectHandler.DeleteInvite)
		api.POST("/workspaces/:slug/projects/:projectId/invitations/:pk/join/", projectHandler.JoinByInvite)

		api.GET("/workspaces/:slug/projects/:projectId/states/", stateHandler.List)
		api.POST("/workspaces/:slug/projects/:projectId/states/", stateHandler.Create)
		api.PATCH("/workspaces/:slug/projects/:projectId/states/:pk/", stateHandler.Update)
		api.DELETE("/workspaces/:slug/projects/:projectId/states/:pk/", stateHandler.Delete)

		api.GET("/workspaces/:slug/projects/:projectId/issue-labels/", labelHandler.List)
		api.POST("/workspaces/:slug/projects/:projectId/issue-labels/", labelHandler.Create)
		api.PATCH("/workspaces/:slug/projects/:projectId/issue-labels/:pk/", labelHandler.Update)
		api.DELETE("/workspaces/:slug/projects/:projectId/issue-labels/:pk/", labelHandler.Delete)

		api.GET("/workspaces/:slug/projects/:projectId/issues/", issueHandler.List)
		api.POST("/workspaces/:slug/projects/:projectId/issues/", issueHandler.Create)
		api.GET("/workspaces/:slug/projects/:projectId/issues/:pk/", issueHandler.Get)
		api.PATCH("/workspaces/:slug/projects/:projectId/issues/:pk/", issueHandler.Update)
		api.DELETE("/workspaces/:slug/projects/:projectId/issues/:pk/", issueHandler.Delete)
		api.GET("/workspaces/:slug/projects/:projectId/issues/:pk/assignees/", issueHandler.ListAssignees)
		api.POST("/workspaces/:slug/projects/:projectId/issues/:pk/assignees/", issueHandler.AddAssignee)
		api.PUT("/workspaces/:slug/projects/:projectId/issues/:pk/assignees/", issueHandler.ReplaceAssignees)
		api.DELETE("/workspaces/:slug/projects/:projectId/issues/:pk/assignees/:assigneeId/", issueHandler.RemoveAssignee)

		api.GET("/workspaces/:slug/projects/:projectId/cycles/", cycleHandler.List)
		api.POST("/workspaces/:slug/projects/:projectId/cycles/", cycleHandler.Create)
		api.GET("/workspaces/:slug/projects/:projectId/cycles/:cycleId/", cycleHandler.Get)
		api.PATCH("/workspaces/:slug/projects/:projectId/cycles/:cycleId/", cycleHandler.Update)
		api.DELETE("/workspaces/:slug/projects/:projectId/cycles/:cycleId/", cycleHandler.Delete)
		api.GET("/workspaces/:slug/projects/:projectId/cycles/:cycleId/issues/", cycleHandler.ListIssues)
		api.POST("/workspaces/:slug/projects/:projectId/cycles/:cycleId/issues/", cycleHandler.AddIssue)
		api.DELETE("/workspaces/:slug/projects/:projectId/cycles/:cycleId/issues/:issueId/", cycleHandler.RemoveIssue)

		api.GET("/workspaces/:slug/projects/:projectId/modules/", moduleHandler.List)
		api.POST("/workspaces/:slug/projects/:projectId/modules/", moduleHandler.Create)
		api.GET("/workspaces/:slug/projects/:projectId/modules/:moduleId/", moduleHandler.Get)
		api.PATCH("/workspaces/:slug/projects/:projectId/modules/:moduleId/", moduleHandler.Update)
		api.DELETE("/workspaces/:slug/projects/:projectId/modules/:moduleId/", moduleHandler.Delete)
		api.GET("/workspaces/:slug/projects/:projectId/modules/:moduleId/issues/", moduleHandler.ListIssues)
		api.POST("/workspaces/:slug/projects/:projectId/modules/:moduleId/issues/", moduleHandler.AddIssue)
		api.DELETE("/workspaces/:slug/projects/:projectId/modules/:moduleId/issues/:issueId/", moduleHandler.RemoveIssue)

		api.GET("/workspaces/:slug/views/", issueViewHandler.List)
		api.POST("/workspaces/:slug/views/", issueViewHandler.Create)
		api.GET("/workspaces/:slug/views/favorites/", issueViewHandler.ListFavorites)
		api.GET("/workspaces/:slug/views/:viewId/", issueViewHandler.Get)
		api.PATCH("/workspaces/:slug/views/:viewId/", issueViewHandler.Update)
		api.DELETE("/workspaces/:slug/views/:viewId/", issueViewHandler.Delete)
		// Favorite: GET is not an action — register so browser opens are explicit 405, not 404.
		api.GET("/workspaces/:slug/views/:viewId/favorite", issueViewHandler.FavoriteWrongMethod)
		api.GET("/workspaces/:slug/views/:viewId/favorite/", issueViewHandler.FavoriteWrongMethod)
		api.POST("/workspaces/:slug/views/:viewId/favorite", issueViewHandler.AddFavorite)
		api.POST("/workspaces/:slug/views/:viewId/favorite/", issueViewHandler.AddFavorite)
		api.DELETE("/workspaces/:slug/views/:viewId/favorite", issueViewHandler.RemoveFavorite)
		api.DELETE("/workspaces/:slug/views/:viewId/favorite/", issueViewHandler.RemoveFavorite)

		api.GET("/workspaces/:slug/pages/", pageHandler.List)
		api.POST("/workspaces/:slug/pages/", pageHandler.Create)
		api.GET("/workspaces/:slug/pages/:pageId/", pageHandler.Get)
		api.PATCH("/workspaces/:slug/pages/:pageId/", pageHandler.Update)
		api.DELETE("/workspaces/:slug/pages/:pageId/", pageHandler.Delete)

		api.GET("/workspaces/:slug/notifications/", notificationHandler.List)
		api.POST("/workspaces/:slug/notifications/mark-all-read/", notificationHandler.MarkAllRead)
		api.POST("/workspaces/:slug/notifications/:id/read/", notificationHandler.MarkRead)

		api.GET("/workspaces/:slug/quick-links/", workspaceLinkHandler.List)
		api.POST("/workspaces/:slug/quick-links/", workspaceLinkHandler.Create)
		api.PATCH("/workspaces/:slug/quick-links/:id/", workspaceLinkHandler.Update)
		api.DELETE("/workspaces/:slug/quick-links/:id/", workspaceLinkHandler.Delete)

		api.GET("/workspaces/:slug/stickies/", stickyHandler.List)
		api.POST("/workspaces/:slug/stickies/", stickyHandler.Create)
		api.PATCH("/workspaces/:slug/stickies/:id/", stickyHandler.Update)
		api.DELETE("/workspaces/:slug/stickies/:id/", stickyHandler.Delete)

		api.GET("/workspaces/:slug/recent-visits/", recentVisitHandler.List)
		api.POST("/workspaces/:slug/recent-visits/", recentVisitHandler.Record)

		api.GET("/workspaces/:slug/projects/:projectId/issues/:pk/comments/", commentHandler.List)
		api.POST("/workspaces/:slug/projects/:projectId/issues/:pk/comments/", commentHandler.Create)
		api.PATCH("/workspaces/:slug/projects/:projectId/issues/:pk/comments/:commentId/", commentHandler.Update)
		api.DELETE("/workspaces/:slug/projects/:projectId/issues/:pk/comments/:commentId/", commentHandler.Delete)
	}

	// Auth routes (no auth required)
	authGroup := r.Group("/auth")
	{
		authGroup.GET("/config/", authHandler.InstanceAuthConfig)
		authGroup.POST("/email-check/", authHandler.EmailCheck)
		authGroup.POST("/sign-in/", authHandler.SignIn)
		authGroup.POST("/sign-up/", authHandler.SignUp)
		authGroup.POST("/sign-out/", authHandler.SignOut)
		authGroup.POST("/forgot-password/", authHandler.ForgotPassword)
		authGroup.POST("/reset-password/", authHandler.ResetPassword)
		authGroup.POST("/magic-code/request/", authHandler.MagicCodeRequest)
		authGroup.POST("/magic-code/verify/", authHandler.MagicCodeVerify)
		authGroup.POST("/set-password/", middleware.RequireAuth(authSvc, cfg.Log), authHandler.SetPassword)
	}

	// OAuth routes (no auth required); provider resolved from instance settings at request time.
	oauthHandler := &handler.OAuthHandler{
		Settings:     instanceSettingStore,
		Workspaces:   workspaceStore,
		Invites:      workspaceInviteStore,
		Auth:         authSvc,
		AppBaseURL:   appBaseURL,
		APIPublicURL: cfg.APIPublicURL,
		Log:          cfg.Log,
	}
	authGroup.GET("/:provider/", oauthHandler.Initiate)
	authGroup.GET("/:provider/callback/", oauthHandler.Callback)

	// Legacy /api/v1
	v1 := r.Group("/api/v1")
	v1.Use(middleware.RequireAuth(authSvc, cfg.Log))
	{
		v1.GET("/", func(c *gin.Context) {
			c.JSON(200, gin.H{"message": "Devlane API v1"})
		})
	}

	return r
}
