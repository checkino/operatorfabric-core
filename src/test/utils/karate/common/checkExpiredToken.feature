Feature: Token

  Background:
    # Token generated one (or several) day(s) before
    # This one generated on 2020/03/13
    * def authToken = "eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJSbXFOVTNLN0x4ck5SRmtIVTJxcTZZcTEya1RDaXNtRkw5U2NwbkNPeDBjIn0.eyJqdGkiOiIzOWQ1ZTA2My1lNGU2LTRjNDItYTk2MC0zM2JkY2YwODEwMTkiLCJleHAiOjE1ODQxNDA4NDAsIm5iZiI6MCwiaWF0IjoxNTg0MTA0ODQwLCJpc3MiOiJodHRwOi8vbG9jYWxob3N0Ojg5L2F1dGgvcmVhbG1zL2RldiIsImF1ZCI6ImFjY291bnQiLCJzdWIiOiJhM2EzYjFhNi0xZWViLTQ0MjktYTY4Yi01ZDVhYjViM2ExMjkiLCJ0eXAiOiJCZWFyZXIiLCJhenAiOiJvcGZhYi1jbGllbnQiLCJhdXRoX3RpbWUiOjAsInNlc3Npb25fc3RhdGUiOiIwMGMwMTg1Ny0wYTc0LTQ0NjMtOGViZi02N2QwNjZhOWRhN2MiLCJhY3IiOiIxIiwicmVhbG1fYWNjZXNzIjp7InJvbGVzIjpbIm9mZmxpbmVfYWNjZXNzIiwidW1hX2F1dGhvcml6YXRpb24iXX0sInJlc291cmNlX2FjY2VzcyI6eyJhY2NvdW50Ijp7InJvbGVzIjpbIm1hbmFnZS1hY2NvdW50IiwibWFuYWdlLWFjY291bnQtbGlua3MiLCJ2aWV3LXByb2ZpbGUiXX19LCJzY29wZSI6ImVtYWlsIHByb2ZpbGUiLCJzdWIiOiJhZG1pbiIsImVtYWlsX3ZlcmlmaWVkIjpmYWxzZSwicHJlZmVycmVkX3VzZXJuYW1lIjoiYWRtaW4ifQ.XeJZunaq7uUx7kuDF64KmNv2_f2si440_6HmYAf-hf-OnW-0qc9Vkbw1Xw2X3NyHlz_XMFG_ARK8WioVRWgq_VXUpZHuyrP78QDTvvVxvvKxEWzMAPsqwIJ7OPjwPs_bxy-3-2FmlJiEB8KU4fxZRGzRBeJu8HmafjW4yEHpv17oi4QPRc-iawwJumqoIfJmxl3Ggcy6vdC_sH5bckNiluTpTQIIboEn4CcMkfo3MymALbBFpvuRq9fdouO_BUc3M93ZCNIPvMTkHgmTC9rYLxKKTWO5sG0esHSsa7442zDW_sxq57XJb7lL5KOfFkY3PY0GPCTBOym63UxU493T0g"

  Scenario: Check Expired Token (generated yesterday)

    # Check Token
    Given url opfabUrl + 'auth/check_token'
    And form field token = authToken
    When method post
    Then status 200
    And match response.active == false