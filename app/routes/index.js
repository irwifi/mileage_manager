"use strict";
const express = require('express');
const router = express.Router();

/* GET home page. */
router.get('/', (req, res, next) => {
	// redirect the home page to readings entry page.
	res.redirect("/readings");
});

module.exports = router;
