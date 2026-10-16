package controller

import (
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

// clinePassChannel is one ClinePass account as the admin panel lists it. The
// channel key is never sent, the panel only needs the windows.
type clinePassChannel struct {
	Id           int                   `json:"id"`
	Name         string                `json:"name"`
	Status       int                   `json:"status"`
	StatusReason string                `json:"status_reason"`
	Group        string                `json:"group"`
	Remark       string                `json:"remark"`
	Usage        *model.ClinePassUsage `json:"usage"`
}

func clinePassChannels() ([]clinePassChannel, error) {
	channels, err := model.GetAllChannels(0, 0, true, false)
	if err != nil {
		return nil, err
	}
	accounts := make([]clinePassChannel, 0, len(channels))
	for _, channel := range channels {
		if !service.IsClinePassChannel(channel) {
			continue
		}
		reason, _ := channel.GetOtherInfo()["status_reason"].(string)
		remark := ""
		if channel.Remark != nil {
			remark = *channel.Remark
		}
		accounts = append(accounts, clinePassChannel{
			Id:           channel.Id,
			Name:         channel.Name,
			Status:       channel.Status,
			StatusReason: reason,
			Group:        channel.Group,
			Remark:       remark,
			Usage:        channel.ChannelInfo.ClinePass,
		})
	}
	return accounts, nil
}

// GetClinePassChannels answers the last usage snapshot of every ClinePass
// account without asking Cline, so the panel can poll it freely.
func GetClinePassChannels(c *gin.Context) {
	accounts, err := clinePassChannels()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": accounts})
}

// RefreshClinePassChannels reads every ClinePass account now, disables the ones
// out of window, and answers the refreshed list.
func RefreshClinePassChannels(c *gin.Context) {
	service.RefreshClinePassChannels()
	accounts, err := clinePassChannels()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": accounts})
}
